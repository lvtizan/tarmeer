import { Link } from 'react-router-dom';
import { designersList } from '../../data/designers';
import DesignerCard from '../designers/DesignerCard';

const MAX_ON_HOME = 8;
const designersOnHome = designersList.slice(0, MAX_ON_HOME);

export default function DesignersSection() {
  return (
    <section id="designers" className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#2c2c2c] font-semibold mb-3">
            Meet the perfect designer for your space and style
          </h2>
          <p className="text-[#6b6b6b] max-w-xl mx-auto">
            Browse by style or location — then work with your chosen designer via WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {designersOnHome.map((d) => (
            <DesignerCard key={d.slug} designer={d} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            to="/designers"
            className="inline-block px-6 py-3 rounded-lg border-2 border-[#c6a065] text-[#c6a065] font-medium hover:bg-[#c6a065] hover:text-white transition"
          >
            View all designers
          </Link>
        </div>
      </div>
    </section>
  );
}
