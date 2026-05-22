
export async function fetchAsDataURL(url: string): Promise<string> {
  // If it's already a Data URI, return immediately (no network request needed)
  if (url.startsWith('data:')) {
    return url;
  }

  // If it's an external URL, attempt to fetch and convert
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao baixar asset: ${url}`);
    const blob = await res.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("PDF Asset Load Error:", error);
    throw error;
  }
}
