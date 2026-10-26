import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { downloadStoredDataBackup } from "../lib/backup";
import { readRawStoredData } from "../lib/storage";

type Props = {
  children: ReactNode;
  /** この値が変わると、エラー状態を解除して再描画する（画面を移動したときなど） */
  resetKey?: string;
  /** 「再読み込み」の動作（テストで差し替えられるようにしている） */
  onReload?: () => void;
  /** 「ホームへ戻る」の動作。省略時はホーム画面（#/）へ移動する */
  onGoHome?: () => void;
};

type State = { error: Error | null; resetKey: string | undefined };

/**
 * 描画中にエラーが起きたとき、画面全体が真っ白になるのを防ぐ。
 * エラーの画面では、保存されている学習データをバックアップとして書き出せる。
 * （学習データは解答のたびに端末へ保存されているため、通常は失われない。念のための退避手段。）
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  /** resetKey が変わったら（画面を移動したら）、エラー状態を解除して再描画する */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("画面の描画中にエラーが発生しました", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  private goHome = (): void => {
    if (this.props.onGoHome) this.props.onGoHome();
    else window.location.hash = "#/";
    this.reset();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <ErrorFallback
        error={error}
        onRetry={this.reset}
        onGoHome={this.goHome}
        onReload={this.props.onReload ?? (() => window.location.reload())}
      />
    );
  }
}

function ErrorFallback({
  error,
  onRetry,
  onGoHome,
  onReload,
}: {
  error: Error;
  onRetry: () => void;
  onGoHome: () => void;
  onReload: () => void;
}) {
  const hasStoredData = readRawStoredData() !== null;
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-16">
      <p className="font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
        問題が発生しました
      </p>
      <p className="mt-3 text-sm leading-relaxed text-(--color-ink-soft)">
        この画面を表示できませんでした。学習記録は解答のたびにこの端末へ保存されているため、通常は失われていません。
        下のボタンから、もう一度試すか、ホーム画面へ戻ってください。
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={onRetry}
          className="rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
        >
          もう一度試す
        </button>
        <button
          onClick={onGoHome}
          className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) py-3 text-sm font-medium text-(--color-ink)"
        >
          ホームへ戻る
        </button>
        <button
          onClick={onReload}
          className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) py-3 text-sm text-(--color-ink)"
        >
          アプリを再読み込みする
        </button>
      </div>

      {hasStoredData && (
        <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4">
          <p className="text-xs leading-relaxed text-(--color-ink-soft)">
            念のため、保存されている学習データをバックアップとして書き出せます。
          </p>
          <button
            onClick={() => downloadStoredDataBackup()}
            className="mt-2 rounded-sm bg-(--color-ink) px-4 py-2 text-xs font-medium text-(--color-paper)"
          >
            学習データをバックアップする
          </button>
        </div>
      )}

      <details className="mt-6 text-xs text-(--color-muted)">
        <summary className="cursor-pointer">エラーの内容</summary>
        <p className="mt-2 break-words font-mono">
          {error.name}: {error.message}
        </p>
      </details>
    </div>
  );
}

/**
 * 画面ごとのエラー境界。画面（パス）を移動すると、エラー状態を自動的に解除する。
 * 画面が壊れても、下のナビゲーションなどは生きたまま、ほかの画面へ移動できる。
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}
