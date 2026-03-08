export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-forest">
      {children}
    </div>
  );
}
