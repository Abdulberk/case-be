# Frontend Auth Migration Guide

## Özet

Backend artık **JWT tabanlı authentication + role-based authorization** kullanıyor.
Eski `x-api-key` header yaklaşımı **kaldırıldı**. Admin mutation'ları artık
`Authorization: Bearer <jwt_token>` header'ı ile ADMIN rolüne sahip bir kullanıcının
JWT token'ı gerektirir.

---

## Ne Değişti? (Backend Değişiklikleri)

### 1. Yeni GraphQL Endpoint'ler

```graphql
type Mutation {
  # Yeni — Public (token gerekmez)
  register(input: RegisterInput!): AuthResponse!
  login(input: LoginInput!): AuthResponse!
}

type Query {
  # Yeni — Authenticated (herhangi bir rol)
  me: User!
}
```

### 2. Admin Mutation'ları Artık JWT + ADMIN Role Gerektiriyor

```graphql
# Eskiden: x-api-key header gerekiyordu
# Şimdi: Authorization: Bearer <admin_jwt_token> header gerekiyor

createCharacter(input: CreateCharacterInput!): Character!   # ADMIN only
updateCharacter(id: ID!, input: UpdateCharacterInput!): Character!  # ADMIN only
deleteCharacter(id: ID!): DeleteResult!                     # ADMIN only
```

### 3. Query'ler Hâlâ Public

```graphql
characters(...)        # Public — token gerekmez
character(id: ID!)     # Public — token gerekmez
characterStats         # Public — token gerekmez
```

### 4. Yeni Type'lar

```graphql
type AuthResponse {
  accessToken: String!    # JWT token
  user: User!
}

type User {
  id: ID!
  email: String!
  name: String!
  role: UserRole!         # USER veya ADMIN
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  USER
  ADMIN
}

input RegisterInput {
  email: String!      # Geçerli email
  password: String!   # Min 6 karakter
  name: String!       # Zorunlu
}

input LoginInput {
  email: String!
  password: String!
}
```

### 5. Hata Mesajları

| Durum | Hata Mesajı |
|---|---|
| Kayıtlı email ile register | `"Email already registered"` |
| Yanlış email/şifre ile login | `"Invalid email or password"` |
| Token olmadan korumalı endpoint | `"Unauthorized"` |
| USER rolü ile admin mutation | `"You do not have permission to perform this action"` |
| Süresi dolmuş/geçersiz token | `"Unauthorized"` |

---

## Frontend'de Yapılması Gereken Değişiklikler

### 1. `src/lib/admin-fetcher.ts` → SİLİN veya DEĞİŞTİRİN

**Eski** (`x-api-key` ile):
```typescript
// SİLİN — artık kullanılmıyor
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';

export async function adminMutationFetcher<TData, TVariables>(...) {
  headers: {
    'x-api-key': ADMIN_API_KEY,  // ❌ Artık çalışmıyor
  },
}
```

**Yeni** — Tek bir fetcher yeterli, JWT token otomatik eklenir:
```typescript
// src/lib/graphql-fetcher.ts — güncellenmiş
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';

export function fetcher<TData, TVariables>(
  query: string,
  variables?: TVariables,
): () => Promise<TData> {
  return async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // JWT token varsa otomatik ekle
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const json = await response.json();

    if (json.errors) {
      const message = json.errors.map((e: { message: string }) => e.message).join(', ');

      // Auth hataları — token'ı temizle ve login'e yönlendir
      if (message.includes('Unauthorized')) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }

      throw new Error(message);
    }

    return json.data;
  };
}
```

### 2. `.env.local` Değişiklikleri

**Kaldırılacak:**
```env
NEXT_PUBLIC_ADMIN_API_KEY=...   # ❌ Artık gerekli değil
```

**Kalacak:**
```env
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```

### 3. Yeni Dosyalar Oluşturun

#### `src/lib/auth-store.ts` — Token/User yönetimi

```typescript
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export function setAuth(accessToken: string, user: AuthUser): void {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('user', JSON.stringify(user));
}

export function getAuth(): AuthState {
  if (typeof window === 'undefined') {
    return { user: null, token: null, isAuthenticated: false, isAdmin: false };
  }

  const token = localStorage.getItem('accessToken');
  const userStr = localStorage.getItem('user');
  const user: AuthUser | null = userStr ? JSON.parse(userStr) : null;

  return {
    user,
    token,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'ADMIN',
  };
}

export function clearAuth(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}
```

#### `src/graphql/register.graphql`

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    accessToken
    user {
      id
      email
      name
      role
    }
  }
}
```

#### `src/graphql/login.graphql`

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
    user {
      id
      email
      name
      role
    }
  }
}
```

#### `src/graphql/me.graphql`

```graphql
query Me {
  me {
    id
    email
    name
    role
    createdAt
    updatedAt
  }
}
```

### 4. `src/generated/graphql.ts` — Yeniden Generate Edin

Yeni mutation/query'leri ekledikten sonra codegen çalıştırın:

```bash
npm run codegen
```

Bu şu yeni type'ları ve hook'ları oluşturacak:
- `RegisterInput`, `LoginInput`, `AuthResponse`, `User`, `UserRole`
- `useRegisterMutation`, `useLoginMutation`, `useMeQuery`

### 5. Auth Hook Oluşturun — `src/hooks/use-auth.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAuth, getAuth, clearAuth, AuthUser } from '../lib/auth-store';

// Basit event-based state sync
const AUTH_CHANGE_EVENT = 'auth-change';

function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState(getAuth);

  useEffect(() => {
    const handler = () => setAuthState(getAuth());
    window.addEventListener(AUTH_CHANGE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const login = useCallback((accessToken: string, user: AuthUser) => {
    setAuth(accessToken, user);
    notifyAuthChange();
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    queryClient.clear();
    notifyAuthChange();
    window.location.href = '/';
  }, [queryClient]);

  return {
    ...authState,
    login,
    logout,
  };
}
```

### 6. Login Sayfası — `src/app/login/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { fetcher } from '@/lib/graphql-fetcher';

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      user { id email name role }
    }
  }
`;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await fetcher<
        { login: { accessToken: string; user: any } },
        { input: { email: string; password: string } }
      >(LOGIN_MUTATION, { input: { email, password } })();

      login(data.login.accessToken, data.login.user);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-bold">Login</h1>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full border rounded px-3 py-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <p className="text-sm text-center">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
```

### 7. Register Sayfası — `src/app/register/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { fetcher } from '@/lib/graphql-fetcher';

const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      user { id email name role }
    }
  }
`;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await fetcher<
        { register: { accessToken: string; user: any } },
        { input: { name: string; email: string; password: string } }
      >(REGISTER_MUTATION, { input: { name, email, password } })();

      login(data.register.accessToken, data.register.user);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-bold">Register</h1>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 characters)"
          required
          minLength={6}
          className="w-full border rounded px-3 py-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Registering...' : 'Register'}
        </button>

        <p className="text-sm text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
```

### 8. Admin Sayfası — Auth Guard Ekleyin

`src/app/admin/page.tsx` dosyasının başına auth kontrolü ekleyin:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!isAdmin) {
      router.replace('/');
      return;
    }
  }, [isAuthenticated, isAdmin, router]);

  if (!isAuthenticated || !isAdmin) {
    return <div>Loading...</div>;
  }

  // ... mevcut admin panel içeriği
}
```

### 9. Header/Navbar — Auth Durumu Gösterin

Header'a login/logout ve kullanıcı bilgisi ekleyin:

```tsx
'use client';

import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

export function AuthButtons() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="flex gap-2">
        <Link href="/login" className="...">Login</Link>
        <Link href="/register" className="...">Register</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">{user?.name}</span>
      {isAdmin && (
        <Link href="/admin" className="...">Admin</Link>
      )}
      <button onClick={logout} className="...">Logout</button>
    </div>
  );
}
```

### 10. Admin Mutation Hook'larını Güncelleyin

**Eski** (admin-fetcher kullanıyordu):
```typescript
import { adminMutationFetcher } from '../lib/admin-fetcher';
// ...
mutationFn: (input) => adminMutationFetcher(MUTATION, { input }),
```

**Yeni** (normal fetcher — JWT otomatik eklenir):
```typescript
import { fetcher } from '../lib/graphql-fetcher';
// ...
mutationFn: (input) => fetcher(MUTATION, { input })(),
```

`src/generated/graphql.ts` yeniden generate edildiğinde hook'lar da güncellenecek.

---

## Adım Adım Migration Checklist

```
1. [ ] `src/lib/admin-fetcher.ts` dosyasını SİLİN
2. [ ] `src/lib/graphql-fetcher.ts` dosyasını güncelleyin (JWT header ekleyin)
3. [ ] `src/lib/auth-store.ts` dosyasını oluşturun
4. [ ] `src/hooks/use-auth.ts` hook'unu oluşturun
5. [ ] `.env.local` dosyasından `NEXT_PUBLIC_ADMIN_API_KEY` satırını kaldırın
6. [ ] `src/graphql/register.graphql` oluşturun
7. [ ] `src/graphql/login.graphql` oluşturun
8. [ ] `src/graphql/me.graphql` oluşturun
9. [ ] `npm run codegen` çalıştırın (yeni type'ları generate edin)
10. [ ] `src/app/login/page.tsx` oluşturun
11. [ ] `src/app/register/page.tsx` oluşturun
12. [ ] `src/app/admin/page.tsx` başına auth guard ekleyin
13. [ ] Header'a AuthButtons component'i ekleyin (login/logout/user info)
14. [ ] Admin mutation hook'larında `adminMutationFetcher` → `fetcher` değiştirin
15. [ ] `adminMutationFetcher` import'larını temizleyin
16. [ ] Admin butonunu sadece ADMIN rolüne sahip kullanıcılara gösterin
```

---

## Test Etme

### Hazır Seed Kullanıcıları

Backend `npx prisma db seed` komutu ile 2 test kullanıcısı oluşturur:

| Email | Password | Role | Açıklama |
|---|---|---|---|
| `admin@example.com` | `admin123` | **ADMIN** | Admin paneli ve mutation'lar için |
| `user@example.com` | `user1234` | **USER** | Normal kullanıcı testi için |

> Seed çalıştırmak için: `npx prisma db seed`
> Şifreleri otomatik olarak bcrypt ile hash'lenir.

### 1. Login ile token alın (seed kullanıcılarıyla)
```graphql
mutation {
  login(input: {
    email: "admin@example.com"
    password: "admin123"
  }) {
    accessToken
    user { id email name role }
  }
}
```

### 3. Admin mutation'ları test edin
```
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

mutation {
  createCharacter(input: {
    name: "Test Hero"
    image: "https://example.com/hero.png"
    description: "A test character for admin panel."
  }) {
    id name
  }
}
```

### 4. Yetki kontrolünü test edin
- Token olmadan mutation → `"Unauthorized"` hatası
- USER token ile mutation → `"You do not have permission to perform this action"` hatası
- ADMIN token ile mutation → ✅ Başarılı

---

## Önemli Notlar

1. **JWT Token süresi:** 7 gün (backend'de `JWT_EXPIRES_IN=7d` olarak ayarlı)
2. **Password:** bcrypt ile hash'leniyor (12 rounds)
3. **Token'da ne var:** `{ sub: userId, email, role }` — backend her request'te DB'den user'ı kontrol ediyor
4. **`NEXT_PUBLIC_ADMIN_API_KEY` artık gerekli DEĞİL** — tamamen kaldırabilirsiniz
5. **Public query'ler değişmedi** — `characters`, `character(id)`, `characterStats` hâlâ token olmadan çalışıyor
6. **Hazır test kullanıcıları:** `npx prisma db seed` ile `admin@example.com` (ADMIN, şifre: `admin123`) ve `user@example.com` (USER, şifre: `user1234`) oluşturulur
