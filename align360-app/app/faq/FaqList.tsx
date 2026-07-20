'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: 'What exactly is ALIGN?',
    a: "ALIGN is a personal operating system that helps you solve today's challenges while building a lifelong understanding of how you're uniquely wired. As you grow, ALIGN grows with you, providing increasingly personalized guidance for life's biggest decisions.",
  },
  {
    q: 'How is ALIGN different from ChatGPT or other AI tools?',
    a: "Most AI starts every conversation with little understanding of you. ALIGN begins by helping you discover how you're uniquely wired, then uses that understanding to provide guidance that's personalized to who you are and where you're headed.",
  },
  {
    q: 'Why does ALIGN begin with understanding me?',
    a: "Because every important decision, your career, relationships, finances, leadership, and future, flows from who you are. Most tools give advice without understanding the person receiving it. ALIGN starts by understanding how you're uniquely wired, so the guidance it provides becomes increasingly personal, relevant, and trustworthy over time.",
  },
  {
    q: 'How does ALIGN get to know me?',
    a: "Through assessments, conversations, and the choices you make over time. Every interaction helps ALIGN build a deeper understanding of how you're wired, making future guidance more personal and relevant.",
  },
  {
    q: 'What happens after I sign up?',
    a: "You'll begin with a free onboarding assessment that provides your first insights into how you're uniquely wired to create and deliver value to the world around you. From there, you'll unlock a growing library of assessments, personalized insights, practical tools, and AI guidance that help you navigate every stage of your journey.",
  },
  {
    q: 'Do I need to complete everything before using it?',
    a: "No. You don't have to finish every assessment before you begin. ALIGN is designed to meet you where you are. Start with whatever challenge you're facing today, then discover your wiring and build your profile at your own pace as you continue to grow.",
  },
  {
    q: 'Is ALIGN just for career planning?',
    a: 'No. Career is only one part of life. ALIGN is designed to help you make better decisions across your career, relationships, finances, health, purpose, and long-term goals.',
  },
  {
    q: 'Who is ALIGN for?',
    a: "ALIGN is for anyone who wants greater clarity, confidence, and direction. Whether you're navigating your career, relationships, finances, leadership, or your next season of life, ALIGN helps you make decisions with greater clarity, confidence, and purpose.",
  },
  {
    q: 'Is my information private?',
    a: 'Yes. Your personal data stays private. Organizations using ALIGN can view group-wide trends and insights, but never individual conversations or personal assessment results unless you explicitly choose to share them.',
  },
  {
    q: "What's the difference between Group and Enterprise?",
    a: 'Group includes the complete ALIGN platform for groups and organizations using it as designed. Enterprise is for organizations that need custom features, integrations, workflows, or implementation tailored to their unique needs.',
  },
  {
    q: 'Will ALIGN replace coaching or counseling?',
    a: 'No. ALIGN is designed to complement, not replace, coaches, mentors, counselors, and trusted advisors. It helps you prepare for those conversations and continue growing between them.',
  },
  {
    q: 'Can I upgrade my plan later?',
    a: 'Yes. You can start as an individual and upgrade to a Group or Enterprise plan whenever your needs grow. Your profile, insights, and history all stay with you.',
  },
];

export default function FaqList() {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="faq-list">
      {FAQS.map((item, i) => {
        const isOpen = open.has(i);
        return (
          <div key={item.q} className={`faq-item${isOpen ? ' open' : ''}`}>
            <button
              className="faq-q"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              aria-controls={`faq-a-${i}`}
            >
              <span>{item.q}</span>
              <span className="faq-toggle" aria-hidden="true">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <div className="faq-a" id={`faq-a-${i}`}>
                <p>{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
