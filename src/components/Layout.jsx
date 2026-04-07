import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-wb-black">
      <main className="fade-in">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
