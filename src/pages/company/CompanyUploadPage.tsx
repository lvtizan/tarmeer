import ProjectUploader from '../../components/ProjectUploader';

export default function CompanyUploadPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-stone-800 mb-2">Upload Project Case</h1>
      <p className="text-stone-500 mb-8">Showcase your company's work to attract homeowners.</p>
      <ProjectUploader ownerType="company" onSuccess={() => window.history.back()} />
    </div>
  );
}
