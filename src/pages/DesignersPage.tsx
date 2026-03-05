import { Link } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { designersList } from '../data/designers';
import DesignerCard from '../components/designers/DesignerCard';

const MAX_DESIGNERS = 50;
const designersToShow = designersList.slice(0, MAX_DESIGNERS);

export default function DesignersPage() {
  return (
    <PageContainer className="py-8 sm:py-12">
        <Link to="/" className="text-[#c6a065] hover:underline text-sm mb-8 inline-block">
          ← Back to Home
        </Link>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c2c2c] mb-2">
          All designers
        </h1>
        <p className="text-[#6b6b6b] mb-10">
          {designersToShow.length} designer{designersToShow.length !== 1 ? 's' : ''}. Click a card to view profile and portfolio.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {designersToShow.map((d) => (
            <DesignerCard key={d.slug} designer={d} />
          ))}
        </div>
    </PageContainer>
  );
}
