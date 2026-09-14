"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Trash2, Copy, Search, Loader2, Image as ImageIcon, Check } from "lucide-react";
import Image from "next/image";
import { toast } from "react-toastify";

interface MediaItem {
  id: string;
  url: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}

export default function MediaLibraryPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/upload?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error("Failed to fetch media");
      const data = await res.json();
      setMedia(data.media || []);
    } catch (error) {
      toast.error("Failed to load media library");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      
      try {
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) throw new Error("Upload failed");
        toast.success(`Uploaded ${file.name}`);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    fetchMedia();
  }, [fetchMedia]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'video/*': ['.mp4', '.webm']
    }
  });

  const handleDelete = async (id: string, publicId: string) => {
    if (!confirm("Are you sure you want to delete this file? This cannot be undone.")) return;
    
    try {
      const res = await fetch("/api/admin/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, publicId }),
      });
      
      if (!res.ok) throw new Error("Delete failed");
      toast.success("File deleted");
      fetchMedia();
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("URL copied to clipboard");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Media Library</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage all your uploaded images and videos</p>
        </div>
      </div>

      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-700 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {isDragActive ? "Drop files here..." : "Click or drag files to upload"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Supports images (JPG, PNG, WebP) and videos (MP4, WebM)
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
        <Search className="w-5 h-5 text-gray-400 ml-2" />
        <input
          type="text"
          placeholder="Search media by ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white"
        />
      </div>

      {loading || uploading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : media.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No media found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Upload some files to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {media.map((item) => (
            <div key={item.id} className="group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
              <div className="aspect-square relative bg-gray-100 dark:bg-gray-900">
                {item.format === 'mp4' || item.format === 'webm' ? (
                  <video src={item.url} className="object-cover w-full h-full" muted loop playsInline />
                ) : (
                  <Image
                    src={item.url}
                    alt={item.publicId}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                )}
                
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                  <button
                    onClick={() => copyToClipboard(item.url, item.id)}
                    className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                    title="Copy URL"
                  >
                    {copiedId === item.id ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.publicId)}
                    className="p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-sm transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.publicId}>
                  {item.publicId.split('/').pop()}
                </p>
                <div className="flex justify-between items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="uppercase">{item.format}</span>
                  <span>{formatBytes(item.bytes)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
