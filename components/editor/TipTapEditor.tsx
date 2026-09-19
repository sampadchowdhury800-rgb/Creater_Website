"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { Youtube } from '@tiptap/extension-youtube';
import { CharacterCount } from '@tiptap/extension-character-count';
import { useCallback, useState } from 'react';
import { 
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, 
  List, ListOrdered, Quote, Code, Undo, Redo, Image as ImageIcon,
  Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, Table as TableIcon,
  Video
} from 'lucide-react';
import { toast } from 'react-toastify';

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const addImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append("file", file);
      
      toast.info("Uploading image...");
      try {
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        
        editor.chain().focus().setImage({ src: data.url }).run();
        toast.success("Image added");
      } catch (err) {
        toast.error("Failed to upload image");
      }
    };
    input.click();
  };

  const addYoutube = () => {
    const url = prompt('Enter YouTube URL');
    if (url) {
      editor.commands.setYoutubeVideo({ src: url });
    }
  };

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-xl sticky top-0 z-10">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Bold size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Italic size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('strike') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Strikethrough size={16} /></button>
      
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 my-auto" />
      
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Heading1 size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Heading2 size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Heading3 size={16} /></button>
      
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 my-auto" />
      
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><AlignLeft size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><AlignCenter size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><AlignRight size={16} /></button>
      
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 my-auto" />
      
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><List size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><ListOrdered size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('blockquote') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Quote size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('codeBlock') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><Code size={16} /></button>
      
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 my-auto" />
      
      <button type="button" onClick={addLink} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('link') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}><LinkIcon size={16} /></button>
      <button type="button" onClick={addImage} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><ImageIcon size={16} /></button>
      <button type="button" onClick={addYoutube} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><Video size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><TableIcon size={16} /></button>
      
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 my-auto" />
      
      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"><Undo size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"><Redo size={16} /></button>
    </div>
  );
};

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export default function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Youtube,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount.configure({ limit: 50000 }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-4',
      },
      handleDrop: function(view, event, slice, moved) {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            const formData = new FormData();
            formData.append("file", file);
            
            toast.info("Uploading image...");
            fetch("/api/admin/upload", { method: "POST", body: formData })
              .then(res => res.json())
              .then(data => {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                const node = schema.nodes.image.create({ src: data.url });
                const transaction = view.state.tr.insert(coordinates?.pos || 0, node);
                view.dispatch(transaction);
                toast.success("Image added");
              })
              .catch(() => toast.error("Upload failed"));
            return true;
          }
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden flex flex-col">
      <MenuBar editor={editor} />
      <div className="flex-1 overflow-y-auto max-h-[600px]">
        <EditorContent editor={editor} />
      </div>
      {editor && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
          {editor.storage.characterCount.characters()} characters
          <br />
          {editor.storage.characterCount.words()} words
        </div>
      )}
    </div>
  );
}
