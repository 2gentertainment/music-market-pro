import React, { useEffect, useRef, useState } from 'react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export default function SupportModal({ isOpen, onClose, userEmail }: SupportModalProps) {
  const [reason, setReason] = useState('Technical Issue');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setSuccess(false);
      setMessage('');
      onClose();
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || success || !message.trim()) return;
    setSubmitting(true);

    const supportPayload = {
      targetEmail: 'musicmarketllc.business@gmail.com',
      reason,
      message: message.trim(),
      userEmail: userEmail || 'Not Provided',
      submittedAt: new Date().toISOString(),
    };

    try {
      // 1. Send via API route if available
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supportPayload),
      });

      if (!res.ok) {
        throw new Error('API route not connected');
      }

      setSuccess(true);
      scheduleClose();
    } catch (err) {
      console.warn('API endpoint unavailable, launching default mail app as fallback...', err);

      // 2. Fallback: Open client mail app pre-filled to musicmarketllc.business@gmail.com
      const subject = encodeURIComponent(`[Music Market Support - ${reason}]`);
      const body = encodeURIComponent(
        `Category: ${reason}\nUser Profile/Email: ${userEmail || 'N/A'}\n\nMessage:\n${message.trim()}`
      );

      window.location.href = `mailto:musicmarketllc.business@gmail.com?subject=${subject}&body=${body}`;

      setSuccess(true);
      scheduleClose();
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-6 text-left shadow-2xl relative">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-lg text-white">Contact Music Market Support</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Direct line to <span className="text-[#ff8c00]">musicmarketllc.business@gmail.com</span>
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-2">
            <div className="text-emerald-400 font-bold text-sm">✓ Message Dispatched!</div>
            <p className="text-xs text-neutral-400">Our support team has received your inquiry and will follow up shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Select Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
              >
                <option value="Billing">Billing & Payouts</option>
                <option value="Technical Issue">Technical Issue / Bug</option>
                <option value="Feedback">Feature Request / Feedback</option>
                <option value="Other">Other Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">How can we help?</label>
              <textarea
                rows={4}
                required
                placeholder="Describe your issue or question in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl p-3 text-xs text-white outline-none resize-none"
              ></textarea>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer transition-all disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}