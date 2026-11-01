export function isVideo(filename: string): boolean {
  return /\.(mp4|m4v|mov|webm|ogv|ogg|mkv|avi|mpeg|mpg|3gp|3g2|ts|mts)$/i.test(filename);
}
export function playbackURL(url: string): string {
  const link = new URL(url);
  link.searchParams.delete("download");
  link.searchParams.set("play", "1");
  return link.toString();
}
