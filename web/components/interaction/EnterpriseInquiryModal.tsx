'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';

interface EnterpriseInquiryModalProps {
  open: boolean;
  onClose: () => void;
  protocolTitle?: string;
}

/**
 * "Early Access" form for the B2B protocols. There is no backend endpoint
 * for this yet -- submitting shows a client-side confirmation only. Wire
 * this to a real Route Handler / CRM webhook before relying on it to
 * actually collect leads.
 */
export function EnterpriseInquiryModal({ open, onClose, protocolTitle }: EnterpriseInquiryModalProps) {
  const t = useTranslations('B2B');
  const [submitted, setSubmitted] = useState(false);

  function handleClose() {
    onClose();
    window.setTimeout(() => setSubmitted(false), 300);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <Modal open={open} onClose={handleClose} labelledBy="inquiry-modal-title">
      {submitted ? (
        <div className="text-center">
          <h2 id="inquiry-modal-title" className="mb-3 font-serif text-xl font-bold text-accent">
            {t('inquiryThanksTitle')}
          </h2>
          <p className="mb-6 text-sm text-gray-400">{t('inquiryThanksBody')}</p>
          <button
            type="button"
            onClick={handleClose}
            className="w-full bg-accent py-3 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white"
          >
            {t('close')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <h2 id="inquiry-modal-title" className="mb-4 font-serif text-lg font-bold text-accent">
            {t('inquiryTitle')}
            {protocolTitle ? ` — ${protocolTitle}` : ''}
          </h2>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-400">
              {t('inquiryName')}
            </label>
            <input
              required
              type="text"
              className="w-full border border-white/20 bg-void p-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-400">
              {t('inquiryEmail')}
            </label>
            <input
              required
              type="email"
              className="w-full border border-white/20 bg-void p-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-400">
              {t('inquiryCompany')}
            </label>
            <input
              required
              type="text"
              className="w-full border border-white/20 bg-void p-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-400">
              {t('inquiryMessage')}
            </label>
            <textarea
              rows={3}
              className="w-full border border-white/20 bg-void p-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-accent py-3 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white"
          >
            {t('inquirySubmit')}
          </button>
        </form>
      )}
    </Modal>
  );
}
