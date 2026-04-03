// Sistema de armazenamento seguro com criptografia AES256 para Shark Loterias
// Implementa cache criptografado e modo offline

import { useState, useEffect } from 'react';

interface StorageItem {
  data: any;
  encrypted: boolean;
  timestamp: number;
  expiresAt?: number;
  version: string;
}

interface OfflineData {
  lotteryTypes: any[];
  frequencies: { [key: string]: any[] };
  analyses: any[];
  userStats: any;
  lastSync: number;
}

class SecureStorageEngine {
  private readonly APP_VERSION = '1.0.0';
  private encryptionKey: string | null = null;
  private isOnline: boolean = navigator.onLine;
  private offlineData: OfflineData;

  constructor() {
    this.initializeEncryptionKey();
    this.initializeOfflineMode();
    this.setupNetworkListeners();
    this.offlineData = this.loadOfflineData();
  }

  private initializeEncryptionKey() {
    // Gerar ou recuperar chave única por dispositivo/usuário
    let deviceKey = localStorage.getItem('shark_device_key');
    
    if (!deviceKey) {
      // Gerar chave baseada em características do dispositivo + timestamp
      const deviceFingerprint = this.generateDeviceFingerprint();
      const timestamp = Date.now().toString();
      deviceKey = btoa(`${deviceFingerprint}-${timestamp}-${Math.random()}`);
      localStorage.setItem('shark_device_key', deviceKey);
    }
    
    this.encryptionKey = `shark-${deviceKey}-2025`;
  }

  private generateDeviceFingerprint(): string {
    // Criar impressão digital do dispositivo (não invasiva)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('Shark Fingerprint', 0, 0);
    const canvasFingerprint = canvas.toDataURL();
    
    return btoa([
      navigator.userAgent.slice(-50),
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.language,
      canvasFingerprint.slice(-20)
    ].join('-')).slice(0, 32);
  }

  // Criptografia usando SubtleCrypto API nativa do navegador
  private async generateKey(password: string): Promise<CryptoKey> {
    if (!password) throw new Error('Chave de criptografia não inicializada');
    
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Salt dinâmico baseado no dispositivo
    const deviceId = localStorage.getItem('shark_device_key') || 'default';
    const dynamicSalt = encoder.encode(`shark-salt-${deviceId}-2025`);

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: dynamicSalt,
        iterations: 150000, // Aumentado para mais segurança
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptData(data: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Sistema de criptografia não inicializado corretamente');
    }

    try {
      const key = await this.generateKey(this.encryptionKey);
      const encoder = new TextEncoder();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(data)
      );

      const encryptedArray = new Uint8Array(encryptedData);
      const result = new Uint8Array(iv.length + encryptedArray.length);
      result.set(iv);
      result.set(encryptedArray, iv.length);

      return btoa(String.fromCharCode.apply(null, Array.from(result)));
    } catch (error) {
      console.error('Erro na criptografia:', error);
      throw error; // Não fazer fallback para plaintext
    }
  }

  private async decryptData(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Sistema de criptografia não inicializado corretamente');
    }

    try {
      const key = await this.generateKey(this.encryptionKey);
      const data = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      const iv = data.slice(0, 12);
      const encrypted = data.slice(12);

      const decryptedData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Erro na descriptografia:', error);
      throw error; // Não fazer fallback
    }
  }

  // Armazenamento seguro
  async setSecureItem(key: string, value: any, encrypt: boolean = true, expiresInHours?: number): Promise<void> {
    const item: StorageItem = {
      data: value,
      encrypted: encrypt,
      timestamp: Date.now(),
      version: this.APP_VERSION,
      expiresAt: expiresInHours ? Date.now() + (expiresInHours * 60 * 60 * 1000) : undefined
    };

    let dataToStore = JSON.stringify(item);
    
    if (encrypt) {
      dataToStore = await this.encryptData(dataToStore);
    }

    localStorage.setItem(`shark_secure_${key}`, dataToStore);
  }

  async getSecureItem<T>(key: string): Promise<T | null> {
    const storedData = localStorage.getItem(`shark_secure_${key}`);
    if (!storedData) return null;

    try {
      let dataString = storedData;
      
      // Tentar descriptografar se parece estar criptografado
      if (!dataString.startsWith('{')) {
        dataString = await this.decryptData(storedData);
      }

      const item: StorageItem = JSON.parse(dataString);

      // Verificar se expirou
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.removeSecureItem(key);
        return null;
      }

      // Verificar versão
      if (item.version !== this.APP_VERSION) {
        console.warn(`Versão diferente detectada para ${key}. Dados podem estar desatualizados.`);
      }

      return item.data as T;
    } catch (error) {
      console.error(`Erro ao recuperar item seguro ${key}:`, error);
      return null;
    }
  }

  removeSecureItem(key: string): void {
    localStorage.removeItem(`shark_secure_${key}`);
  }

  // Sistema de modo offline
  private initializeOfflineMode() {
    // Service Worker básico para cache de assets críticos
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.log('Service Worker não disponível:', error);
      });
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineData();
      this.emitNetworkStatus(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emitNetworkStatus(false);
    });
  }

  private emitNetworkStatus(online: boolean) {
    window.dispatchEvent(new CustomEvent('sharkNetworkStatus', {
      detail: { online, message: online ? 'Conectado - Dados sincronizados' : 'Offline - Usando cache local' }
    }));
  }

  // Gerenciamento de dados offline
  async cacheForOffline(key: string, data: any, priority: 'high' | 'medium' | 'low' = 'medium') {
    await this.setSecureItem(`offline_${key}`, {
      data,
      priority,
      cachedAt: Date.now()
    }, true, priority === 'high' ? 24 : priority === 'medium' ? 6 : 2);
  }

  async getOfflineData<T>(key: string): Promise<T | null> {
    return await this.getSecureItem<{ data: T }>(`offline_${key}`)
      .then(result => result ? result.data : null);
  }

  private loadOfflineData(): OfflineData {
    const defaultData: OfflineData = {
      lotteryTypes: [],
      frequencies: {},
      analyses: [],
      userStats: null,
      lastSync: 0
    };

    try {
      const saved = localStorage.getItem('shark_offline_data');
      return saved ? JSON.parse(saved) : defaultData;
    } catch {
      return defaultData;
    }
  }

  private saveOfflineData() {
    localStorage.setItem('shark_offline_data', JSON.stringify(this.offlineData));
  }

  async syncOfflineData() {
    if (!this.isOnline) return;

    try {
      // Simular sincronização com servidor
      console.log('🔄 Sincronizando dados offline...');
      
      // Aqui seria feita a sincronização real com a API
      this.offlineData.lastSync = Date.now();
      this.saveOfflineData();
      
      console.log('✅ Sincronização completa!');
      
      window.dispatchEvent(new CustomEvent('sharkDataSynced', {
        detail: { timestamp: this.offlineData.lastSync }
      }));
    } catch (error) {
      console.error('Erro na sincronização:', error);
    }
  }

  // Verificação de integridade da aplicação
  async verifyAppIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Verificar versão dos dados
      const storedVersion = localStorage.getItem('shark_app_version');
      if (storedVersion !== this.APP_VERSION) {
        issues.push(`Versão da aplicação mudou: ${storedVersion} → ${this.APP_VERSION}`);
        localStorage.setItem('shark_app_version', this.APP_VERSION);
      }

      // Verificar integridade dos dados críticos
      const criticalKeys = ['gamification_stats', 'achievements', 'missions'];
      for (const key of criticalKeys) {
        const data = await this.getSecureItem(key);
        if (data && typeof data !== 'object') {
          issues.push(`Dados corrompidos detectados: ${key}`);
        }
      }

      // Verificar capacidade de criptografia
      const testData = 'teste-integridade-2025';
      const encrypted = await this.encryptData(testData);
      const decrypted = await this.decryptData(encrypted);
      
      if (decrypted !== testData) {
        issues.push('Sistema de criptografia apresenta falhas');
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Erro na verificação de integridade: ${error}`]
      };
    }
  }

  // Limpeza automática de cache antigo
  async cleanupOldCache() {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('shark_'));
    let cleaned = 0;

    for (const key of keys) {
      try {
        const item = await this.getSecureItem(key.replace('shark_secure_', ''));
        if (item === null) { // Item expirado foi automaticamente removido
          cleaned++;
        }
      } catch (error) {
        // Remove dados corrompidos
        localStorage.removeItem(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache limpo: ${cleaned} itens removidos`);
    }
  }

  // Status do sistema
  getSystemStatus() {
    return {
      online: this.isOnline,
      lastSync: this.offlineData.lastSync,
      cacheSize: this.calculateCacheSize(),
      version: this.APP_VERSION,
      encryptionAvailable: 'crypto' in window && 'subtle' in window.crypto
    };
  }

  private calculateCacheSize(): string {
    let total = 0;
    for (let key in localStorage) {
      if (key.startsWith('shark_')) {
        total += localStorage.getItem(key)?.length || 0;
      }
    }
    return `${(total / 1024).toFixed(2)} KB`;
  }
}

// Instância singleton
export const secureStorage = new SecureStorageEngine();

// Hook para usar armazenamento seguro
export function useSecureStorage() {
  const [systemStatus, setSystemStatus] = useState(secureStorage.getSystemStatus());
  const [integrityStatus, setIntegrityStatus] = useState<{ valid: boolean; issues: string[] } | null>(null);

  useEffect(() => {
    const updateStatus = () => setSystemStatus(secureStorage.getSystemStatus());
    
    // Listeners de rede
    const handleNetworkStatus = (event: any) => {
      updateStatus();
    };

    const handleDataSync = () => {
      updateStatus();
    };

    window.addEventListener('sharkNetworkStatus', handleNetworkStatus);
    window.addEventListener('sharkDataSynced', handleDataSync);

    // Verificação de integridade inicial
    secureStorage.verifyAppIntegrity().then(setIntegrityStatus);

    // Limpeza de cache a cada 24 horas
    const cleanupInterval = setInterval(() => {
      secureStorage.cleanupOldCache();
    }, 24 * 60 * 60 * 1000);

    return () => {
      window.removeEventListener('sharkNetworkStatus', handleNetworkStatus);
      window.removeEventListener('sharkDataSynced', handleDataSync);
      clearInterval(cleanupInterval);
    };
  }, []);

  return {
    setSecureItem: secureStorage.setSecureItem.bind(secureStorage),
    getSecureItem: secureStorage.getSecureItem.bind(secureStorage),
    removeSecureItem: secureStorage.removeSecureItem.bind(secureStorage),
    cacheForOffline: secureStorage.cacheForOffline.bind(secureStorage),
    getOfflineData: secureStorage.getOfflineData.bind(secureStorage),
    syncOfflineData: secureStorage.syncOfflineData.bind(secureStorage),
    verifyAppIntegrity: secureStorage.verifyAppIntegrity.bind(secureStorage),
    systemStatus,
    integrityStatus,
    isOnline: systemStatus.online
  };
}