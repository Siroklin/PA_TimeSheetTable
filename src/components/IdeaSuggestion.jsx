import { useState } from 'react';
import { submitIdea } from '../api';

export default function IdeaSuggestion({ onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await submitIdea(text.trim());
      setSent(true);
    } catch (e) {
      setError(e.message || 'Не удалось отправить предложение.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-idea">
        <div className="modal-header">
          <div className="modal-title">Предложить идею для улучшения</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {sent ? (
            <div className="idea-sent">Спасибо! Ваше предложение отправлено.</div>
          ) : (
            <>
              <div className="form-group">
                <label>Ваше предложение</label>
                <textarea
                  className="comment-input"
                  rows={6}
                  placeholder="Опишите, что можно улучшить..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <div className="upload-error-line">{error}</div>}
            </>
          )}
        </div>

        <div className="modal-footer">
          {sent ? (
            <button className="btn-save" onClick={onClose}>Закрыть</button>
          ) : (
            <>
              <button className="btn-cancel" onClick={onClose}>Отмена</button>
              <button className="btn-save" onClick={handleSend} disabled={!text.trim() || sending}>
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
