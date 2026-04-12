/**
 * Auth Client - Frontend utilities for authentication
 */

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  role: 'FREE' | 'PREMIUM';
  subscriptionExpires?: string;
}

export class AuthClient {
  private tokenKey = 'token';
  private userKey = 'user';

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  removeToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  getUser(): AuthUser | null {
    const user = localStorage.getItem(this.userKey);
    return user ? JSON.parse(user) : null;
  }

  setUser(user: AuthUser): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  removeUser(): void {
    localStorage.removeItem(this.userKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isPremium(): boolean {
    const user = this.getUser();
    return user?.role === 'PREMIUM';
  }

  logout(): void {
    this.removeToken();
    this.removeUser();
  }

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

export const authClient = new AuthClient();
