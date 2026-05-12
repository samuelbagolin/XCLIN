import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="medical-card p-8 max-w-md w-full bg-white text-center space-y-6 animate-in fade-in zoom-in duration-300 shadow-2xl rounded-3xl border border-slate-100">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50/50">
              <AlertTriangle size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Ops! Algo deu errado.</h2>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                Não foi possível carregar este módulo no momento. Estamos trabalhando para corrigir isso automaticamente.
              </p>
            </div>
            {this.state.error && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-400 font-mono break-all max-h-24 overflow-y-auto custom-scrollbar">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button 
                onClick={this.handleReset}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                <RefreshCw size={18} />
                Tentar Novamente
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="btn-secondary w-full flex items-center justify-center gap-2 py-3"
              >
                <Home size={18} />
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
