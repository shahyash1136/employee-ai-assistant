import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { AuthProvider } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { APPROVER_ROLES } from "@/lib/roles";
import { ApprovalsPage } from "@/pages/approvals-page";
import { ChatPage } from "@/pages/chat-page";
import { LoginPage } from "@/pages/login-page";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                {/* /chat = new conversation, /chat/:sessionId = a saved one */}
                <Route path="/chat/:sessionId?" element={<ChatPage />} />
                <Route element={<ProtectedRoute roles={APPROVER_ROLES} />}>
                  <Route path="/approvals" element={<ApprovalsPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
