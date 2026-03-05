import { isWartime, getCurrentConfig } from '../config/site-config';

export default function WartimeNotice() {
  if (!isWartime()) return null;

  const config = getCurrentConfig();
  // In wartime mode, notice is guaranteed to be set
  const notice = config.notice;

  return (
    <div className="bg-gradient-to-r from-[#c6a065] to-[#d4b47a] text-white py-3 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-sm font-medium">
          {notice}
        </p>
      </div>
    </div>
  );
}
