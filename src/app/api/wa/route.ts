import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { evo, hasEvolution, instanceFor, mapState } from "@/lib/evolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function currentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Dono do time (dono se for membro ativo; senão o próprio usuário).
async function resolveTeam(userId: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("member_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.team_id ?? userId;
}

// Grava o estado da sessão. Usa a chave secreta (RLS de escrita é do worker),
// mas cai para o client autenticado se a service key não estiver configurada.
async function saveSession(ownerId: string, patch: Record<string, unknown>) {
  const row = { owner_id: ownerId, last_seen: new Date().toISOString(), ...patch };
  if (hasAdmin()) {
    await createAdminClient()
      .from("prospect_wa_sessions")
      .upsert(row, { onConflict: "owner_id" });
  }
}

// Busca o QR no Evolution. O Baileys (por baixo do Evolution) emite o QR de
// forma assíncrona: logo após create/logout a 1ª resposta costuma vir sem
// base64. Tenta algumas vezes.
async function fetchQr(instance: string) {
  for (let i = 0; i < 6; i++) {
    const conn = await evo(`/instance/connect/${instance}`)
      .then((r) => r.json())
      .catch(() => ({} as Record<string, unknown>));
    const qr =
      (conn as { base64?: string; qrcode?: { base64?: string } }).base64 ??
      (conn as { qrcode?: { base64?: string } }).qrcode?.base64 ??
      null;
    const pairingCode =
      (conn as { pairingCode?: string; code?: string }).pairingCode ??
      (conn as { code?: string }).code ??
      null;
    if (qr) return { qr, pairingCode };
    await sleep(1200);
  }
  return { qr: null, pairingCode: null };
}

export async function POST(req: Request) {
  if (!hasEvolution()) {
    return NextResponse.json(
      { error: "Evolution API não configurado (EVOLUTION_API_URL / EVOLUTION_API_KEY)." },
      { status: 400 }
    );
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  let body: { action?: "connect" | "status" | "disconnect" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const action = body.action;

  const ownerId = await resolveTeam(user.id);
  const instance = instanceFor(ownerId);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const secret = process.env.WA_WEBHOOK_SECRET ?? "";
  const webhook = {
    enabled: true,
    url: `${siteUrl}/api/webhooks/evolution?secret=${secret}`,
    byEvents: false,
    base64: true,
    events: ["CONNECTION_UPDATE"],
  };

  try {
    if (action === "connect") {
      // Já existe a instância?
      const list = await evo(`/instance/fetchInstances?instanceName=${instance}`)
        .then((r) => r.json())
        .catch(() => []);
      const exists =
        Array.isArray(list) &&
        list.some(
          (i: { name?: string; instance?: { instanceName?: string } }) =>
            (i.name ?? i.instance?.instanceName) === instance
        );

      if (!exists) {
        await evo("/instance/create", {
          method: "POST",
          body: JSON.stringify({
            instanceName: instance,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            webhook,
          }),
        }).catch(() => {});
      } else {
        await evo(`/webhook/set/${instance}`, {
          method: "POST",
          body: JSON.stringify({ webhook }),
        }).catch(() => {});

        const st = await evo(`/instance/connectionState/${instance}`)
          .then((r) => r.json())
          .catch(() => ({}));
        const state = st.instance?.state ?? st.state;

        if (state === "open") {
          await saveSession(ownerId, {
            instance_name: instance,
            status: "conectado",
            qr: null,
            pairing_code: null,
          });
          return NextResponse.json({ status: "conectado", qr: null });
        }

        // Antes de forçar QR novo, tenta retomar a sessão com um restart
        // (a maioria das quedas é temporária e volta sozinha, sem QR).
        await evo(`/instance/restart/${instance}`, { method: "POST" }).catch(() => {});
        for (let i = 0; i < 6; i++) {
          await sleep(1500);
          const s2 = await evo(`/instance/connectionState/${instance}`)
            .then((r) => r.json())
            .catch(() => ({}));
          if ((s2.instance?.state ?? s2.state) === "open") {
            await saveSession(ownerId, {
              instance_name: instance,
              status: "conectado",
              qr: null,
              pairing_code: null,
            });
            return NextResponse.json({ status: "conectado", qr: null });
          }
        }

        // Não retomou → sessão inválida: logout para gerar QR novo.
        await evo(`/instance/logout/${instance}`, { method: "DELETE" }).catch(() => {});
        await sleep(1000);
      }

      const { qr, pairingCode } = await fetchQr(instance);
      await saveSession(ownerId, {
        instance_name: instance,
        status: "conectando",
        qr,
        pairing_code: pairingCode,
      });
      return NextResponse.json({ status: "conectando", qr, pairingCode });
    }

    if (action === "status") {
      const st = await evo(`/instance/connectionState/${instance}`)
        .then((r) => r.json())
        .catch(() => ({}));
      const status = mapState(st.instance?.state ?? st.state);
      await saveSession(ownerId, {
        instance_name: instance,
        status,
        ...(status === "conectado" ? { qr: null, pairing_code: null } : {}),
      });
      return NextResponse.json({ status });
    }

    if (action === "disconnect") {
      await evo(`/instance/logout/${instance}`, { method: "DELETE" }).catch(() => {});
      await saveSession(ownerId, {
        instance_name: instance,
        status: "desconectado",
        qr: null,
        pairing_code: null,
        phone: null,
      });
      return NextResponse.json({ status: "desconectado" });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao falar com o Evolution.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
