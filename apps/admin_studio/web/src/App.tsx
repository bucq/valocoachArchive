import { useState } from 'react';
import CollectPage from './components/CollectPage.tsx';
import Sidebar from './components/layout/Sidebar.tsx';
import ReviewPage from './components/ReviewPage.tsx';
import TagPage from './components/TagPage.tsx';
import VideoListPage from './components/VideoListPage.tsx';

export type Page = 'videos' | 'collect' | 'tag' | 'review';

export default function App() {
  const [page, setPage] = useState<Page>('videos');

  return (
    <div className="flex h-screen bg-canvas text-body overflow-hidden">
      <div className="fixed inset-0 dot-grid pointer-events-none" style={{ opacity: 0.45 }} />
      <Sidebar current={page} onNavigate={setPage} />
      <main className="relative flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {page === 'videos' && <VideoListPage />}
          {page === 'collect' && <CollectPage />}
          {page === 'tag' && <TagPage />}
          {page === 'review' && <ReviewPage />}
        </div>
      </main>
    </div>
  );
}
