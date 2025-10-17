import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

@customElement('bom-assistant')
export class BomAssistant extends LitElement {
  createRenderRoot() {
    return this; // Use light DOM for Tailwind
  }

  @state() private messages: ChatMessage[] = [
    { role: 'assistant', content: 'Upload a BOM CSV or describe what parts you need. I can help you find components and check stock via Mouser.' },
  ];
  @state() private bomText: string | null = null;
  @state() private sending = false;

  private apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3000';

  render() {
    return html`
      <div class="flex flex-col h-screen max-w-5xl mx-auto p-4 gap-4">
        <div class="navbar bg-base-200 rounded-box">
          <div class="flex-1">
            <span class="text-xl font-bold">Mouser BOM Assistant</span>
          </div>
          <div class="flex-none gap-2">
            <input type="file" accept=".csv" class="file-input file-input-bordered file-input-sm" @change=${this.onFile} />
            ${this.bomText ? html`<div class="badge badge-success">BOM loaded</div>` : ''}
          </div>
        </div>

        <div id="chat" class="flex-1 overflow-y-auto bg-base-200 rounded-box p-4 space-y-3">
          ${this.messages.map(m => html`
            <div class="chat ${m.role === 'user' ? 'chat-end' : 'chat-start'}">
              <div class="chat-bubble ${m.role === 'user' ? 'bg-base-300' : 'bg-base-content/10'}">
                <pre class="whitespace-pre-wrap text-sm">${m.content}</pre>
              </div>
            </div>
          `)}
        </div>

        <div class="flex gap-2">
          <textarea
            id="t"
            class="textarea textarea-bordered flex-1"
            placeholder="Ask me to find parts, check stock, or suggest alternatives..."
            @keydown=${this.onKey}
            rows="2"
          ></textarea>
          <button class="btn btn-primary" ?disabled=${this.sending} @click=${this.send}>
            ${this.sending ? html`<span class="loading loading-spinner"></span>` : 'Send'}
          </button>
        </div>
      </div>
    `;
  }

  private onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    this.bomText = text;
    // Auto-trigger the agent
    await this.sendToAgent();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.send();
    }
  };

  private async send() {
    if (this.sending) return;
    const ta = this.renderRoot.querySelector('#t') as HTMLTextAreaElement;
    const text = (ta?.value || '').trim();
    if (!text) return;
    this.messages = [...this.messages, { role: 'user', content: text }];
    ta.value = '';
    await this.sendToAgent();
  }

  private async sendToAgent() {
    if (this.sending) return;
    this.sending = true;

    try {
      const response = await fetch(`${this.apiBase}/api/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bomCsv: this.bomText,
          messages: this.messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        this.messages = [...this.messages, { role: 'assistant', content: 'No response stream.' }];
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === 'status') {
            this.messages = [...this.messages, { role: 'assistant', content: `_${data.message}_` }];
          } else if (data.type === 'tool_call') {
            const argsStr = JSON.stringify(data.args).slice(0, 100);
            this.messages = [...this.messages, { role: 'assistant', content: `🔧 **${data.name}**(${argsStr}...)` }];
          } else if (data.type === 'tool_result') {
            const resultStr = typeof data.result === 'string' ? data.result : JSON.stringify(data.result).slice(0, 150);
            this.messages = [...this.messages, { role: 'assistant', content: `✓ Result: ${resultStr}` }];
          } else if (data.type === 'message') {
            this.messages = [...this.messages, { role: 'assistant', content: data.content }];
          } else if (data.type === 'error') {
            this.messages = [...this.messages, { role: 'assistant', content: `Error: ${data.error}` }];
          }
          // Auto-scroll to bottom
          await this.updateComplete;
          const chat = this.renderRoot.querySelector('#chat');
          if (chat) chat.scrollTop = chat.scrollHeight;
        }
      }
    } catch (e: any) {
      this.messages = [...this.messages, { role: 'assistant', content: `Server error: ${e.message || e}` }];
    } finally {
      this.sending = false;
    }
  }
}

declare global { interface HTMLElementTagNameMap { 'bom-assistant': BomAssistant } }

