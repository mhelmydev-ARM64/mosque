import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { firebaseReady } from "../lib/firebase";
import { useAuth } from "../features/auth/AuthContext";
import { AuthProvider } from "../features/auth/AuthContext";
import { AppearanceProvider } from "./theme/ThemeProvider";
import { ToastProvider, Loading, EmptyState } from "../components/ui";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { AccountStatusPage } from "../features/auth/AccountStatusPage";

const HomePage = lazy(() => import("../features/home/HomePage"));
const StudentsPage = lazy(() => import("../features/students/StudentsPage"));
const StudentEditorPage = lazy(() => import("../features/students/StudentEditorPage"));
const RequestsPage = lazy(() => import("../features/requests/RequestsPage"));
const FinancePage = lazy(() => import("../features/finance/FinancePage"));
const ChatListPage = lazy(() => import("../features/chat/ChatListPage"));
const ChatChannelPage = lazy(() => import("../features/chat/ChatChannelPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const MorePage = lazy(() => import("../features/more/MorePage"));
const ExcelPage = lazy(() => import("../features/excel/ExcelPage"));
const AdminLayout = lazy(() => import("../features/admin/AdminLayout"));
const ApprovalInboxPage = lazy(() => import("../features/admin/ApprovalInboxPage"));
const UsersAdminPage = lazy(() => import("../features/admin/UsersAdminPage"));
const CommitteesAdminPage = lazy(() => import("../features/admin/CommitteesAdminPage"));
const TemplateEditorPage = lazy(() => import("../features/admin/TemplateEditorPage"));
const RoutingAdminPage = lazy(() => import("../features/admin/RoutingAdminPage"));
const ChannelsAdminPage = lazy(() => import("../features/admin/ChannelsAdminPage"));

function SetupRequired() {
  return (
    <div className="auth-wrap">
      <div className="auth-card card" style={{ boxShadow: "var(--shadow)" }}>
        <div className="auth-logo">⚙️</div>
        <h1 className="auth-title">إعداد مطلوب</h1>
        <p className="muted small">
          لم يتم ضبط إعدادات Firebase بعد. أنشئ ملف <code>.env</code> من <code>.env.example</code> وأدخل مفاتيح مشروعك، ثم أعد تشغيل التطبيق. التفاصيل في README.
        </p>
      </div>
    </div>
  );
}

function FullPageLoading() {
  return (
    <div className="auth-wrap">
      <Loading />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { authUser, authLoading } = useAuth();
  if (!firebaseReady) return <SetupRequired />;
  if (authLoading) return <FullPageLoading />;
  if (!authUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireApproved({ children }: { children: ReactNode }) {
  const { user, userLoading, logout } = useAuth();
  if (userLoading) return <FullPageLoading />;
  if (!user) {
    return (
      <div className="auth-wrap">
        <div className="auth-card card" style={{ boxShadow: "var(--shadow)" }}>
          <h1 className="auth-title">لا توجد بيانات حساب</h1>
          <p className="muted small">حسابك غير موجود في قاعدة البيانات. قد يكون حُذف من قِبل الإدارة.</p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => void logout()}>
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }
  if (user.status !== "approved") return <Navigate to="/status" replace />;
  return <>{children}</>;
}

function Page({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      {children}
    </Suspense>
  );
}

export function AppRouter() {
  return (
    <AppearanceProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route
                path="/status"
                element={
                  <RequireAuth>
                    <AccountStatusPage />
                  </RequireAuth>
                }
              />

              <Route
                path="*"
                element={
                  <RequireAuth>
                    <RequireApproved>
                      <Routes>
                        <Route
                          path="/"
                          element={
                            <Page>
                              <HomePage />
                            </Page>
                          }
                        />
                        <Route
                          path="/students"
                          element={
                            <Page>
                              <StudentsPage />
                            </Page>
                          }
                        />
                        <Route
                          path="/students/new"
                          element={
                            <Page>
                              <StudentEditorPage />
                            </Page>
                          }
                        />
                        <Route
                          path="/students/:studentId"
                          element={
                            <Page>
                              <StudentEditorPage />
                            </Page>
                          }
                        />
                        <Route
                          path="/requests"
                          element={
                            <Page>
                              <RequestsPage />
                            </Page>
                          }
                        />
                        <Route
                          path="/finance"
                          element={
                            <Page>
                              <FinancePage />
                            </Page>
                          }
                        />
                        <Route
                          path="/chat"
                          element={
                            <Page>
                              <ChatListPage />
                            </Page>
                          }
                        />
                        <Route
                          path="/chat/:channelId"
                          element={
                            <Page>
                              <ChatChannelPage />
                            </Page>
                          }
                        />
                        <Route
                          path="/more"
                          element={
                            <Page>
                              <MorePage />
                            </Page>
                          }
                        />
                        <Route
                          path="/settings"
                          element={
                            <Page>
                              <SettingsPage />
                            </Page>
                          }
                        />
                        <Route
                          path="/excel"
                          element={
                            <Page>
                              <ExcelPage />
                            </Page>
                          }
                        />
                        <Route
                          path="/admin/*"
                          element={
                            <Page>
                              <AdminLayout>
                                <Routes>
                                  <Route index element={<ApprovalInboxPage />} />
                                  <Route path="users" element={<UsersAdminPage />} />
                                  <Route path="committees" element={<CommitteesAdminPage />} />
                                  <Route path="template" element={<TemplateEditorPage />} />
                                  <Route path="routing" element={<RoutingAdminPage />} />
                                  <Route path="channels" element={<ChannelsAdminPage />} />
                                  <Route
                                    path="*"
                                    element={<EmptyState icon="🧭" title="الصفحة غير موجودة" />}
                                  />
                                </Routes>
                              </AdminLayout>
                            </Page>
                          }
                        />
                        <Route path="*" element={<EmptyState icon="🧭" title="الصفحة غير موجودة" />} />
                      </Routes>
                    </RequireApproved>
                  </RequireAuth>
                }
              />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </AppearanceProvider>
  );
}
