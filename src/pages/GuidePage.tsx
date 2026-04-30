import { Helmet } from 'react-helmet-async';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import PageContainer from '../components/PageContainer';

interface Step {
  number: number;
  title: string;
  description: string;
  detail?: string;
  required?: boolean;
  optional?: boolean;
}

const STEPS: Step[] = [
{
    number: 1,
    title: 'Create Your Account',
    description: 'Go to tarmeer.com/for-companies. Fill in your company name, contact person name, phone number, and select your company type.',
    detail: 'You can sign up with your email or continue with Google.',
  },
  {
    number: 2,
    title: 'Verify Your Email',
    description: 'Check your inbox for a verification email from Tarmeer and click the confirmation link to activate your account.',
    detail: 'If you do not see it within a few minutes, check your spam folder.',
  },
  {
    number: 3,
    title: 'Set Up Your Company Profile',
    description: 'Enter your business details: the services you offer, your operating city, and a short description of your company.',
  },
{
    number: 4,
    title: 'Upload Your First Project',
    description: 'Add at least one portfolio project with photos, a project title, the city it was done in, and the design style. This step is required to publish your listing.',
    detail: 'Use high-quality photos. Projects with 4 or more images get significantly more views from homeowners.',
    required: true,
  },
  {
    number: 5,
    title: 'Complete Your Profile',
    description: 'Optionally add specialties, years in business, and a richer description. You can skip this and return later from your dashboard.',
    optional: true,
  },
  {
    number: 6,
    title: 'You Are Live',
    description: 'Your company profile is now visible to homeowners searching for design and renovation services across the UAE. Inquiries will come through our team.',
    detail: 'Add more projects anytime from your dashboard to increase your visibility.',
  },
];
export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>Getting Started Guide - Tarmeer for Companies</title>
        <meta
          name="description"
          content="Step-by-step guide for design and renovation companies joining Tarmeer. Set up your profile, upload your portfolio, and reach homeowners across the UAE."
        />
        <link rel="canonical" href="https://www.tarmeer.com/start" />
        <meta property="og:title" content="Getting Started Guide - Tarmeer for Companies" />
        <meta property="og:description" content="Step-by-step guide for design and renovation companies joining Tarmeer." />
        <meta property="og:url" content="https://www.tarmeer.com/start" />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <PageContainer className="py-12 sm:py-20">
<div className="max-w-2xl mb-12 sm:mb-16">
          <p className="text-sm font-medium text-[#b8864a] uppercase tracking-widest mb-3">
            Company Setup
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#2c2c2c] leading-tight mb-4">
            Get your company live on Tarmeer
          </h1>
          <p className="text-[17px] text-[#6b6b6b] leading-relaxed">
            Follow the steps below to set up your profile, upload your portfolio, and start
            receiving inquiries from homeowners in the UAE.
          </p>
          <a
            href="/for-companies"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-[#b8864a] text-white text-[15px] font-medium rounded-2xl hover:bg-[#a07540] transition-colors"
          >
            Start here
            <ArrowRight size={16} />
          </a>
        </div>
<div className="max-w-2xl">
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <div key={step.number} className="flex gap-5 sm:gap-7">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold border-2 ${
                      isLast
                        ? 'bg-[#b8864a] border-[#b8864a] text-white'
                        : 'bg-white border-[#b8864a] text-[#b8864a]'
                    }`}
                  >
                    {isLast ? <CheckCircle2 size={20} strokeWidth={2.5} /> : step.number}
                  </div>
                  {!isLast && <div className="flex-1 w-px bg-stone-200 mt-2 mb-2" />}
                </div>
<div className={`min-w-0 ${isLast ? 'pb-0' : 'pb-10'}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h2 className="text-[17px] font-semibold text-[#2c2c2c]">{step.title}</h2>
                    {step.required && (
                      <span className="text-xs font-semibold bg-[#b8864a]/10 text-[#b8864a] px-2 py-0.5 rounded-full border border-[#b8864a]/20">
                        Required
                      </span>
                    )}
                    {step.optional && (
                      <span className="text-xs font-medium bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] text-[#6b6b6b] leading-relaxed">{step.description}</p>
                  {step.detail && (
                    <p className="mt-2 text-[13px] text-stone-400 leading-relaxed">{step.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
<div className="max-w-2xl mt-14 pt-10 border-t border-stone-200">
          <p className="text-[15px] text-[#6b6b6b] mb-4">
            Ready to get started? Create your account in under 2 minutes.
          </p>
          <a
            href="/for-companies"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#2c2c2c] text-white text-[15px] font-medium rounded-2xl hover:bg-[#1a1a1a] transition-colors"
          >
            Create your account
            <ArrowRight size={16} />
          </a>
        </div>
      </PageContainer>
    </div>
  );
}

