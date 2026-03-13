import { useState } from 'react';
import { Link } from 'react-router-dom';

const PRIMARY = '#b8864a';

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    philosophy: '',
    agree: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: connect to backend
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#2c2c2c] flex flex-col">
      {/* Top nav */}
      <header className="flex items-center justify-between border-b border-stone-200 px-4 sm:px-6 lg:px-10 py-4 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="text-[24px]" style={{ color: PRIMARY }}>
            <span className="font-serif">T</span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Tarmeer.com</h2>
        </div>
        <div className="flex items-center gap-4">
          <p className="hidden sm:block text-sm text-[#6b6b6b]">Already a partner?</p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-lg h-9 px-4 text-sm font-bold"
            style={{ backgroundColor: PRIMARY, color: '#1c1917' }}
          >
            Login
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero + metrics */}
        <section className="px-4 sm:px-6 lg:px-10 py-10 sm:py-14 lg:py-16 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <span
                  className="font-bold tracking-widest uppercase text-xs"
                  style={{ color: PRIMARY }}
                >
                  Join the UAE&apos;s Designer Network
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                  Empower Your <span style={{ color: PRIMARY }}>Design</span> Vision
                </h1>
                <p className="text-[#6b6b6b] text-base sm:text-lg leading-relaxed max-w-xl">
                  Showcase your interior and architectural projects, connect with premium clients,
                  and access a curated global supply chain for high-end materials.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1 p-4 rounded-xl bg-white border border-stone-100 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6b6b6b]">
                    Designers
                  </p>
                  <p className="text-2xl font-black text-[#2c2c2c]">200+</p>
                </div>
                <div className="flex flex-col gap-1 p-4 rounded-xl bg-white border border-stone-100 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6b6b6b]">
                    Projects
                  </p>
                  <p className="text-2xl font-black text-[#2c2c2c]">600+</p>
                </div>
                <div className="flex flex-col gap-1 p-4 rounded-xl bg-white border border-stone-100 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6b6b6b]">
                    Suppliers
                  </p>
                  <p className="text-2xl font-black text-[#2c2c2c]">80+</p>
                </div>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-700"
                   style={{ backgroundImage: 'linear-gradient(to right, #b8864a, #e5c28a)' }} />
              <div
                className="relative w-full aspect-[4/3] bg-center bg-no-repeat bg-cover rounded-xl shadow-2xl overflow-hidden"
                style={{
                  backgroundImage: 'url(/images/showroom-sharjah-panorama.png)',
                }}
              />
            </div>
          </div>
        </section>

        {/* Registration card */}
        <section className="bg-white py-10 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Designer Registration</h2>
              <p className="text-sm sm:text-base text-[#6b6b6b]">
                Complete this step to join our professional network.
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl shadow-xl p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-[#2c2c2c]">Full Name</label>
                    <input
                      name="fullName"
                      type="text"
                      required
                      value={form.fullName}
                      onChange={handleChange}
                      placeholder="Architect John Doe"
                      className="rounded-lg border border-stone-300 bg-[#faf9f7] px-3 py-2.5 text-sm focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-[#2c2c2c]">
                      Professional Email
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      placeholder="name@studio.com"
                      className="rounded-lg border border-stone-300 bg-[#faf9f7] px-3 py-2.5 text-sm focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-[#2c2c2c]">Phone / WhatsApp</label>
                    <input
                      name="phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+971 50 123 4567"
                      className="rounded-lg border border-stone-300 bg-[#faf9f7] px-3 py-2.5 text-sm focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-[#2c2c2c]">City</label>
                    <select
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      className="rounded-lg border border-stone-300 bg-[#faf9f7] px-3 py-2.5 text-sm focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40 outline-none"
                    >
                      <option value="">Select City</option>
                      <option value="dubai">Dubai</option>
                      <option value="sharjah">Sharjah</option>
                      <option value="abu-dhabi">Abu Dhabi</option>
                      <option value="ajman">Ajman</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#2c2c2c]">
                    Tell us about your design philosophy
                  </label>
                  <textarea
                    name="philosophy"
                    rows={4}
                    value={form.philosophy}
                    onChange={handleChange}
                    placeholder="Briefly describe your style and approach..."
                    className="rounded-lg border border-stone-300 bg-[#faf9f7] px-3 py-2.5 text-sm focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40 outline-none resize-y"
                  />
                </div>
                <div className="flex flex-col gap-4 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="agree"
                      checked={form.agree}
                      onChange={handleChange}
                      className="mt-1 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                    />
                    <span className="text-sm text-[#6b6b6b]">
                      I agree to Tarmeer&apos;s{' '}
                      <span className="text-[#b8864a]">Terms of Service</span> and{' '}
                      <span className="text-[#b8864a]">Privacy Policy</span>.
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="w-full btn-primary py-3.5 text-base font-semibold shadow-lg"
                  >
                    Submit Registration
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

