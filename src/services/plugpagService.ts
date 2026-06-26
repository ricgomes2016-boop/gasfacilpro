/**
 * PlugPag Service - Preparação para integração com SDK PlugPag (PagBank)
 * 
 * Este serviço abstrai a comunicação com terminais Smart Pro via Bluetooth.
 * Requer build nativo com Capacitor + plugin Android customizado.
 * 
 * Fluxo:
 * 1. Descoberta de dispositivos Bluetooth (terminais PagBank)
 * 2. Pareamento automático com terminal configurado
 * 3. Envio de transação (crédito/débito)
 * 4. Recebimento do resultado (NSU, autorização, etc)
 */

export interface PlugPagDevice {
  name: string;
  address: string; // MAC address Bluetooth
  serialNumber: string;
  model: string;
}

export interface PlugPagTransaction {
  amount: number; // em centavos
  type: 'credit' | 'debit';
  installments?: number;
  printReceipt?: boolean;
}

export interface PlugPagResult {
  success: boolean;
  nsu?: string;
  authorizationCode?: string;
  transactionId?: string;
  cardBrand?: string;
  cardLastDigits?: string;
  errorMessage?: string;
  errorCode?: string;
}

// Estado do serviço
let isNativeAvailable = false;
let connectedDevice: PlugPagDevice | null = null;

/**
 * Verifica se o ambiente nativo (Capacitor) está disponível
 */
export function isPlugPagAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Inicializa o serviço PlugPag
 * Em ambiente PWA, retorna false (sem suporte nativo)
 */
export async function initPlugPag(): Promise<boolean> {
  if (!isPlugPagAvailable()) {
    console.log('[PlugPag] Ambiente PWA detectado - modo simulado ativo');
    isNativeAvailable = false;
    return false;
  }

  try {
    // @ts-expect-error Plugin Capacitor customizado
    const { PlugPagPlugin } = await import('@capacitor-community/plugpag');
    await PlugPagPlugin.initialize();
    isNativeAvailable = true;
    console.log('[PlugPag] SDK inicializado com sucesso');
    return true;
  } catch (err) {
    console.error('[PlugPag] Erro ao inicializar:', err);
    isNativeAvailable = false;
    return false;
  }
}

/**
 * Busca terminais PagBank disponíveis via Bluetooth
 */
export async function discoverDevices(): Promise<PlugPagDevice[]> {
  if (!isNativeAvailable) {
    console.log('[PlugPag] Descoberta simulada - retornando lista vazia');
    return [];
  }

  try {
    // @ts-expect-error Plugin Capacitor customizado
    const { PlugPagPlugin } = await import('@capacitor-community/plugpag');
    const result = await PlugPagPlugin.discoverDevices();
    return result.devices || [];
  } catch (err) {
    console.error('[PlugPag] Erro na descoberta:', err);
    return [];
  }
}

/**
 * Conecta a um terminal específico via Bluetooth
 */
export async function connectDevice(device: PlugPagDevice): Promise<boolean> {
  if (!isNativeAvailable) {
    console.log('[PlugPag] Conexão simulada com:', device.name);
    connectedDevice = device;
    return true;
  }

  try {
    // @ts-expect-error Plugin Capacitor customizado
    const { PlugPagPlugin } = await import('@capacitor-community/plugpag');
    await PlugPagPlugin.connect({ address: device.address });
    connectedDevice = device;
    console.log('[PlugPag] Conectado a:', device.name);
    return true;
  } catch (err) {
    console.error('[PlugPag] Erro ao conectar:', err);
    return false;
  }
}

/**
 * Desconecta do terminal atual
 */
export async function disconnectDevice(): Promise<void> {
  if (isNativeAvailable && connectedDevice) {
    try {
      // @ts-expect-error Plugin Capacitor customizado
      const { PlugPagPlugin } = await import('@capacitor-community/plugpag');
      await PlugPagPlugin.disconnect();
    } catch (err) {
      console.error('[PlugPag] Erro ao desconectar:', err);
    }
  }
  connectedDevice = null;
}

/**
 * Executa uma transação de pagamento no terminal conectado
 */
export async function executePayment(transaction: PlugPagTransaction): Promise<PlugPagResult> {
  if (!connectedDevice) {
    return { success: false, errorMessage: 'Nenhum terminal conectado' };
  }

  if (!isNativeAvailable) {
    console.log('[PlugPag] Pagamento simulado:', transaction);
    return {
      success: false,
      errorMessage: 'SDK nativo não disponível. Use o fluxo via backend.',
    };
  }

  try {
    // @ts-expect-error Plugin Capacitor customizado
    const { PlugPagPlugin } = await import('@capacitor-community/plugpag');
    const result = await PlugPagPlugin.doPayment({
      amount: transaction.amount,
      type: transaction.type === 'credit' ? 1 : 2,
      installments: transaction.installments || 1,
      printReceipt: transaction.printReceipt ?? true,
    });

    return {
      success: result.success,
      nsu: result.nsu,
      authorizationCode: result.authorizationCode,
      transactionId: result.transactionId,
      cardBrand: result.cardBrand,
      cardLastDigits: result.cardLastDigits,
    };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: err.message || 'Erro ao processar pagamento',
      errorCode: err.code,
    };
  }
}

/**
 * Retorna o dispositivo atualmente conectado
 */
export function getConnectedDevice(): PlugPagDevice | null {
  return connectedDevice;
}

/**
 * Verifica se há um terminal conectado
 */
export function isDeviceConnected(): boolean {
  return connectedDevice !== null;
}
