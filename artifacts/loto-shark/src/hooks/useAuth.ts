
interface User {
  id: string;
  name: string;
  email: string;
}

const mockUser: User = {
  id: "guest-user",
  name: "SHARK User",
  email: "user@sharkloto.com"
};

export function useAuth() {
  // Retorna dados estáticos sem usar React Query para evitar conflitos
  return {
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
  };
}
