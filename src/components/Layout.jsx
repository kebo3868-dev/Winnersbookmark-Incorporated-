import BottomNav from './BottomNav';

export default function Layout({ children, noPad = false }) {
  return (
    <div className="min-h-screen bg-wb-black">
      <main className={`fade-in ${noPad ? '' : 'pb-20'}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
