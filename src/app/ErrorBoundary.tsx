import { Component, type ErrorInfo, type ReactNode } from "react";

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
}

/**
 * شبكة أمان على مستوى التطبيق كله: أي خطأ غير متوقع في زمن التشغيل
 * (بما فيه أعطال نادرة داخل SDK قاعدة البيانات) يعرض شاشة استرجاع
 * واضحة بدل شاشة بيضاء، ولا يفقد المستخدم إلا إعادة التحميل.
 */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught app error:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="auth-wrap">
        <div className="card auth-card col">
          <h1 className="auth-title">حدث خطأ غير متوقع</h1>
          <p className="auth-sub">أعد تحميل التطبيق للمتابعة من حيث توقفت. إن تكرر الخطأ فأبلغ الإدارة.</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            إعادة تحميل التطبيق
          </button>
        </div>
      </div>
    );
  }
}
