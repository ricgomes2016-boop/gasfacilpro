UPDATE integracoes_whatsapp 
SET provedor = 'evolution', 
    instance_id = 'centralgas_matriz', 
    token = 'gasfacilpro', 
    meta_phone_number_id = NULL, 
    meta_verify_token = NULL, 
    security_token = NULL, 
    updated_at = now() 
WHERE id = 'ad769548-dbd8-4813-a4c4-372eb4cc75af';