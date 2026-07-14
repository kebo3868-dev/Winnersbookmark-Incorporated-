import ImagePlaceholder from './ImagePlaceholder';
export default function LifestyleCard({ item }) {
  return (
    <article className="glass overflow-hidden hover:-translate-y-1 transition-all duration-300">
      {/* Replace with licensed images in /public/images using item.image paths. */}
      <ImagePlaceholder ratio="aspect-[4/3]" label={item.title} caption={item.image} />
      <div className="card-pad">
        <h3 className="font-semibold text-paper">{item.title}</h3>
        <p className="text-sm text-mist mt-2 leading-relaxed">{item.text}</p>
      </div>
    </article>
  );
}
