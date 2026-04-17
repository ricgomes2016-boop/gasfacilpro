import { supabase } from "@/integrations/supabase/client";

let watchId:number|null = null;
let lastSend = 0;

export const iniciarRastreamento = (entregadorId:string) => {
  if (!navigator.geolocation) return;

  watchId = navigator.geolocation.watchPosition(async (pos)=>{
    const now = Date.now();
    if (now - lastSend < 10000) return;
    lastSend = now;

    const { latitude, longitude } = pos.coords;

    await supabase.from("localizacao_entregador").insert({
      entregador_id: entregadorId,
      latitude,
      longitude,
      created_at: new Date().toISOString()
    });

  }, console.error, {
    enableHighAccuracy:true,
    maximumAge:5000,
    timeout:10000
  });
};

export const pararRastreamento = () => {
  if (watchId!==null){
    navigator.geolocation.clearWatch(watchId);
    watchId=null;
  }
};
