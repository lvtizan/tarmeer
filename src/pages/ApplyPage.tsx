import { Link } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { Package, TrendingUp, Users, UserPlus, Store, Handshake } from 'lucide-react';
import { api } from '../lib/api';
import { trackAnalyticsEvent } from '../lib/analytics';

const PRIMARY = '#b8864a';

/* Benefits from recruitment landing - our copy */
const BENEFITS = [
  {
    title: 'Premium Supply Chains',
    text: 'Connect directly with vetted, premium Chinese manufacturers for materials, fixtures, and custom furniture at wholesale rates.',
    icon: Package,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  },
  {
    title: 'Increase Project Volume',
    text: 'Get matched with high-value interior design and construction projects from residential and commercial clients in the MENA region.',
    icon: TrendingUp,
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80',
  },
  {
    title: 'Top Design Community',
    text: 'Network with leading interior designers, architects, and industry experts in the region. Share insights and collaborate on large-scale builds.',
    icon: Users,
    image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80',
  },
];

const STEPS = [
  { title: 'Quick Registration', text: 'Create your account and submit your profile for review by our expert panel.', icon: UserPlus },
  { title: 'Profile Approval', text: 'After approval, publish your professional profile and showcase your best MENA projects.', icon: Store },
  { title: 'Start Getting Leads', text: 'Receive matched project opportunities and unlock supplier resources at no registration cost.', icon: Handshake },
];

export default function ApplyPage() {
  const applyTarget = api.getToken() ? '/dashboard' : '/auth?tab=register';

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[420px] sm:min-h-[500px] flex flex-col justify-center items-center text-center px-4 py-12 sm:py-16 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.8)), url(https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1600&q=80)`,
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto">
          <span
            className="inline-block py-1.5 px-4 rounded-full text-sm font-bold tracking-wider uppercase mb-4"
            style={{ backgroundColor: `${PRIMARY}20`, color: PRIMARY, border: `1px solid ${PRIMARY}40` }}
          >
            Join Our Network
          </span>
          <h1 className="font-serif text-white text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-4">
            Join the Tarmeer Designer Network
          </h1>
          <p className="text-slate-200 text-lg sm:text-xl font-medium leading-relaxed max-w-2xl mx-auto mb-6">
            Access premium suppliers, quality project leads, and direct Tarmeer support.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={applyTarget}
              className="btn-primary inline-flex items-center justify-center min-w-[160px] h-12 lg:h-14 px-8 text-base lg:text-lg text-white"
              onClick={() => trackAnalyticsEvent('apply_click', { placement: 'hero' })}
            >
              Apply Now
            </Link>
          </div>
        </div>
      </section>

      <PageContainer className="py-12 sm:py-20">
        {/* How It Works */}
        <section className="mb-16 lg:mb-24 bg-stone-50 rounded-lg p-8 lg:p-12 border border-stone-200">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#2c2c2c] mb-4">
              How It Works
            </h2>
            <p className="text-[#6b6b6b] text-lg max-w-2xl mx-auto">
              Register, get reviewed, get approved, and start receiving real opportunities.
            </p>
            <p className="mt-3 inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: `${PRIMARY}15`, color: PRIMARY }}>
              No registration fee required.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-stone-200 z-0" />
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative z-10 flex flex-col items-center text-center">
                  <div
                    className="w-24 h-24 rounded-full border-4 border-stone-100 flex items-center justify-center mb-6 shadow-sm bg-white"
                    style={i === 2 ? { backgroundColor: PRIMARY, borderColor: 'transparent' } : {}}
                  >
                    <Icon
                      className="w-10 h-10"
                      style={{ color: i === 2 ? '#fff' : PRIMARY }}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-[#2c2c2c] mb-2">{step.title}</h3>
                  <p className="text-[#6b6b6b] text-sm px-4">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="mb-16 lg:mb-24">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#2c2c2c] mb-4">
              Benefits of the Network
            </h2>
            <p className="text-[#6b6b6b] text-lg max-w-2xl mx-auto">
              Unlock exclusive resources and opportunities to elevate your interior design business across the Middle East.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="flex flex-col group">
                  <div className="w-full aspect-[4/3] bg-cover bg-center rounded-lg mb-6 shadow-md overflow-hidden">
                    <img
                      src={b.image}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80';
                      }}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-[#2c2c2c] mb-3 flex items-center gap-2">
                    <Icon className="w-5 h-5" style={{ color: PRIMARY }} />
                    {b.title}
                  </h3>
                  <p className="text-[#6b6b6b] leading-relaxed">{b.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA block */}
        <section className="mb-16">
          <div
            className="rounded-lg p-8 lg:p-16 text-center shadow-xl relative overflow-hidden"
            style={{ backgroundColor: '#1c1917' }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: PRIMARY, marginTop: '-4rem', marginRight: '-4rem' }} />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: PRIMARY, marginBottom: '-4rem', marginLeft: '-4rem' }} />
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-white text-3xl lg:text-5xl font-bold leading-tight mb-6">
                Ready to Transform Your Design Business?
              </h2>
              <p className="text-stone-300 text-lg mb-8">
                Join hundreds of top designers who are already leveraging the Tarmeer network to source better and build faster.
              </p>
              <Link
                to={applyTarget}
                className="btn-primary inline-flex items-center justify-center min-w-[200px] h-14 px-10 text-lg font-bold text-white"
                onClick={() => trackAnalyticsEvent('apply_click', { placement: 'cta' })}
              >
                Apply Now
              </Link>
            </div>
          </div>
        </section>
      </PageContainer>
    </div>
  );
}
