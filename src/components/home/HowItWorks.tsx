import React from 'react';
import { Utensils, PhoneCall, Bike } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      num: '01',
      icon: Utensils,
      title: 'Select Your Food',
      desc: 'Browse our signature soups, rice varieties, or yam & egg with your preferred swallow and protein choices.'
    },
    {
      num: '02',
      icon: PhoneCall,
      title: 'Frictionless Checkout',
      desc: 'No passwords or mandatory accounts. Enter your phone number and address in Agbani for instant order dispatch.'
    },
    {
      num: '03',
      icon: Bike,
      title: 'Real-Time Concierge Tracking',
      desc: 'Follow your meal from kitchen cooking to rider dispatch with direct rider call support.'
    }
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" id="how">
      <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
        <span className="text-xs uppercase font-extrabold tracking-widest text-amber-700">Seamless Delivery</span>
        <h2 className="font-serif text-3xl sm:text-4xl font-extrabold text-brand-ink">
          How JayFoodCourt <span className="text-amber-600">Works</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="relative bg-brand-cream/60 rounded-3xl p-8 border border-brand-line space-y-4 hover:border-brand-gold transition shadow-xs"
            >
              <span className="absolute top-6 right-8 font-serif text-5xl font-black text-brand-gold/30">
                {step.num}
              </span>
              <div className="w-14 h-14 rounded-2xl bg-brand-gold flex items-center justify-center text-brand-ink shadow-sm">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-brand-ink">{step.title}</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
