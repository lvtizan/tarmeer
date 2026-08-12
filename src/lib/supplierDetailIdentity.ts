export interface SupplierIdentityToken {
  identity: string;
  version: number;
}

export function createSupplierIdentityGuard(initialIdentity: string) {
  let identity = initialIdentity;
  let version = 0;
  let activeVersion = 0;
  return {
    begin(nextIdentity: string): SupplierIdentityToken {
      identity = nextIdentity;
      activeVersion = ++version;
      return { identity, version: activeVersion };
    },
    isCurrent(token: SupplierIdentityToken): boolean {
      return token.identity === identity && token.version === activeVersion;
    },
    cancel(token: SupplierIdentityToken): void {
      if (this.isCurrent(token)) activeVersion = ++version;
    },
  };
}

export function isSupplierContentStale(loadedIdentity: string, requestIdentity: string): boolean {
  return loadedIdentity !== requestIdentity;
}
