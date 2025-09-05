"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Add client-side only rendering hook to prevent hydration mismatches
const useClientOnly = () => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
};

// Generate unique IDs
function makeId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      const hex = Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  } catch {}
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

// Load notes from localStorage
function loadNotes() {
  try {
    const raw = localStorage.getItem("notesAppData");
    const data = raw ? JSON.parse(raw) : { folders: [], notes: [] };
    return {
      folders: Array.isArray(data.folders) ? data.folders : [],
      notes: Array.isArray(data.notes) ? data.notes : []
    };
  } catch {
    return { folders: [], notes: [] };
  }
}

// Save notes to localStorage
function saveNotes(data) {
  try {
    localStorage.setItem("notesAppData", JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save notes:", e);
  }
}

// Default folder for focus area notes
const FOCUS_AREAS_FOLDER = "Focus Areas";

// Load focus areas from localStorage
function loadFocusAreas() {
  try {
    const raw = localStorage.getItem("focusCategories");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function NotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = useClientOnly(); // Add client-side only rendering
  const [notesData, setNotesData] = useState({ folders: [], notes: [] });
  const [focusAreas, setFocusAreas] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const textareaRef = useRef(null);
  const newFolderInputRef = useRef(null);
  const newNoteInputRef = useRef(null);

  // Get focus area from URL params
  const focusArea = searchParams?.get('focus') || '';

  // Load data on mount
  useEffect(() => {
    if (!isClient) return; // Don't run on server
    const data = loadNotes();
    const areas = loadFocusAreas();
    setFocusAreas(areas);
    
    // Clean up duplicate focus area folders (keep only those that are subfolders)
    const cleanedFolders = data.folders.filter(folder => {
      // Keep Focus Areas folder
      if (folder.name === FOCUS_AREAS_FOLDER) return true;
      // Keep folders that are NOT focus areas
      if (!areas.some(area => area.label === folder.name)) return true;
      // Remove standalone focus area folders (they should only exist as subfolders)
      return false;
    });
    
    // Ensure Focus Areas folder exists
    let focusAreasFolder = cleanedFolders.find(f => f.name === FOCUS_AREAS_FOLDER);
    if (!focusAreasFolder) {
      focusAreasFolder = {
        id: makeId(),
        name: FOCUS_AREAS_FOLDER,
        color: "#8CA4AF",
        createdAt: Date.now()
      };
      cleanedFolders.unshift(focusAreasFolder);
    }
    
    // Update data if we cleaned up folders
    if (cleanedFolders.length !== data.folders.length) {
      const updatedData = { ...data, folders: cleanedFolders };
      setNotesData(updatedData);
      saveNotes(updatedData);
    } else {
      setNotesData(data);
    }
    
    // If coming from focus area, select the Focus Areas folder
    if (focusArea) {
      setSelectedFolder(focusAreasFolder.id);
    }
  }, [focusArea, isClient]);

  // Listen for focus area changes
  useEffect(() => {
    if (!isClient) return; // Don't run on server
    const handleStorageChange = (e) => {
      if (e.key === "focusCategories") {
        const areas = loadFocusAreas();
        setFocusAreas(areas);
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [isClient]);

  // Auto-save note content
  useEffect(() => {
    if (!isClient || !selectedNote || !isEditing) return; // Don't run on server
    
    const timeoutId = setTimeout(() => {
      const updatedNotes = notesData.notes.map(note => 
        note.id === selectedNote.id ? selectedNote : note
      );
      const updatedData = { ...notesData, notes: updatedNotes };
      setNotesData(updatedData);
      saveNotes(updatedData);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [selectedNote, isEditing, notesData, isClient]);

  // Focus textarea when editing and collapse sidebar
  useEffect(() => {
    if (!isClient || !isEditing || !textareaRef.current) return; // Don't run on server
    textareaRef.current.focus();
    setSidebarCollapsed(true);
  }, [isEditing, isClient]);

  // Focus new folder input when modal opens
  useEffect(() => {
    if (!isClient || !showNewFolderModal || !newFolderInputRef.current) return; // Don't run on server
    newFolderInputRef.current.focus();
  }, [showNewFolderModal, isClient]);

  // Focus new note input when modal opens
  useEffect(() => {
    if (!isClient || !showNewNoteModal || !newNoteInputRef.current) return; // Don't run on server
    newNoteInputRef.current.focus();
  }, [showNewNoteModal, isClient]);

  // Get current folder
  const currentFolder = notesData.folders.find(f => f.id === selectedFolder);

  // Get notes for current folder
  const folderNotes = useMemo(() => {
    if (!selectedFolder) return [];
    
    // If selected folder is Focus Areas, show all notes from focus area subfolders
    const currentFolder = notesData.folders.find(f => f.id === selectedFolder);
    if (currentFolder?.name === FOCUS_AREAS_FOLDER) {
      return notesData.notes
        .filter(note => {
          const noteFolder = notesData.folders.find(f => f.id === note.folderId);
          return noteFolder && focusAreas.some(area => area.label === noteFolder.name);
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    
    return notesData.notes
      .filter(note => note.folderId === selectedFolder)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notesData.notes, selectedFolder, focusAreas]);

  // Filter notes by search
  const filteredNotes = useMemo(() => {
    if (!searchQuery) return folderNotes;
    return folderNotes.filter(note => 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [folderNotes, searchQuery]);

  // Show loading state if not on client yet
  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] text-[#4E4034]">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold">Notes</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                </svg>
              </button>
            </div>
          </div>
        </header>
        
        <div className="flex h-[calc(100vh-73px)]">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-semibold mb-2 text-[#4E4034]">Loading Notes...</div>
              <div className="text-sm text-gray-500">Please wait while we prepare your notes.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Create new note
  const createNote = () => {
    if (!selectedFolder) return;
    
    const title = newNoteTitle.trim() || "New Note";
    let targetFolderId = selectedFolder;
    
    // If creating note in Focus Areas folder, create it in the specific focus area subfolder
    const currentFolder = notesData.folders.find(f => f.id === selectedFolder);
    if (currentFolder?.name === FOCUS_AREAS_FOLDER && focusArea) {
      // Find or create the specific focus area subfolder
      let focusAreaFolder = notesData.folders.find(f => f.name === focusArea);
      if (!focusAreaFolder) {
        focusAreaFolder = {
          id: makeId(),
          name: focusArea,
          color: "#8CA4AF",
          createdAt: Date.now()
        };
        const updatedData = {
          ...notesData,
          folders: [...notesData.folders, focusAreaFolder]
        };
        setNotesData(updatedData);
        saveNotes(updatedData);
      }
      targetFolderId = focusAreaFolder.id;
    }
    
    const newNote = {
      id: makeId(),
      title: title,
      content: "",
      folderId: targetFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const updatedData = {
      ...notesData,
      notes: [newNote, ...notesData.notes]
    };
    setNotesData(updatedData);
    saveNotes(updatedData);
    setSelectedNote(newNote);
    setIsEditing(true);
    setNewNoteTitle("");
    setShowNewNoteModal(false);
  };

  // Update note
  const updateNote = (updates) => {
    if (!selectedNote) return;
    setSelectedNote({ ...selectedNote, ...updates, updatedAt: Date.now() });
  };

  // Delete note
  const deleteNote = (noteId) => {
    const updatedData = {
      ...notesData,
      notes: notesData.notes.filter(note => note.id !== noteId)
    };
    setNotesData(updatedData);
    saveNotes(updatedData);
    
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setIsEditing(false);
    }
  };

  // Create new folder
  const createFolder = () => {
    if (!newFolderName.trim()) return;
    
    const newFolder = {
      id: makeId(),
      name: newFolderName.trim(),
      color: "#8CA4AF",
      createdAt: Date.now()
    };
    
    const updatedData = {
      ...notesData,
      folders: [...notesData.folders, newFolder]
    };
    setNotesData(updatedData);
    saveNotes(updatedData);
    setNewFolderName("");
    setShowNewFolderModal(false);
    setSelectedFolder(newFolder.id);
  };

  // Delete folder
  const deleteFolder = (folderId) => {
    const updatedData = {
      ...notesData,
      folders: notesData.folders.filter(f => f.id !== folderId),
      notes: notesData.notes.filter(note => note.folderId !== folderId)
    };
    setNotesData(updatedData);
    saveNotes(updatedData);
    
    if (selectedFolder === folderId) {
      setSelectedFolder(null);
      setSelectedNote(null);
      setIsEditing(false);
    }
    setShowDeleteConfirm(null);
  };

  // Format date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get note preview
  const getNotePreview = (content) => {
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#4E4034]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold">Notes</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M4 6h16M4 12h16M4 18h16" : "M4 6h16M4 12h8m-8 6h16"} />
              </svg>
            </button>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="New Folder"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-80'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out`}>
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8CA4AF]"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Folders */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {/* Focus Areas folder with subfolders */}
              {notesData.folders
                .filter(folder => folder.name === FOCUS_AREAS_FOLDER)
                .map(folder => (
                  <div key={folder.id}>
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedFolder === folder.id ? 'bg-[#8CA4AF] text-white' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        setSelectedFolder(folder.id);
                        setSelectedNote(null);
                        setIsEditing(false);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: folder.color }}
                        />
                        <span className="font-medium">{folder.name}</span>
                        <span className="text-sm opacity-70">
                          ({notesData.notes.filter(note => {
                            const noteFolder = notesData.folders.find(f => f.id === note.folderId);
                            return noteFolder && focusAreas.some(area => area.label === noteFolder.name);
                          }).length})
                        </span>
                      </div>
                      {/* Focus Areas folder cannot be deleted */}
                    </div>
                    
                    {/* Focus area subfolders */}
                    {focusAreas.map(area => {
                      let subfolder = notesData.folders.find(f => f.name === area.label);
                      
                      // Create subfolder if it doesn't exist
                      if (!subfolder) {
                        subfolder = {
                          id: makeId(),
                          name: area.label,
                          color: area.color || "#8CA4AF",
                          createdAt: Date.now()
                        };
                        const updatedData = {
                          ...notesData,
                          folders: [...notesData.folders, subfolder]
                        };
                        setNotesData(updatedData);
                        saveNotes(updatedData);
                      }
                      
                      const noteCount = notesData.notes.filter(n => n.folderId === subfolder.id).length;
                      
                      return (
                        <div
                          key={area.label}
                          className={`flex items-center justify-between p-3 ml-4 rounded-lg cursor-pointer transition-colors ${
                            selectedFolder === subfolder?.id ? 'bg-[#8CA4AF] text-white' : 'hover:bg-gray-100'
                          }`}
                          onClick={() => {
                            setSelectedFolder(subfolder.id);
                            setSelectedNote(null);
                            setIsEditing(false);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: area.color || "#8CA4AF" }}
                            />
                            <span className="font-medium text-sm">{area.label}</span>
                            <span className="text-xs opacity-70">
                              ({noteCount})
                            </span>
                          </div>
                          {subfolder && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(subfolder.id);
                              }}
                              className="p-1 hover:bg-white/20 rounded"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              
              {/* Other folders */}
              {notesData.folders
                .filter(folder => {
                  // Exclude Focus Areas folder and any focus area subfolders
                  return folder.name !== FOCUS_AREAS_FOLDER && 
                         !focusAreas.some(area => area.label === folder.name);
                })
                .map(folder => (
                  <div
                    key={folder.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedFolder === folder.id ? 'bg-[#8CA4AF] text-white' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setSelectedFolder(folder.id);
                      setSelectedNote(null);
                      setIsEditing(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: folder.color }}
                      />
                      <span className="font-medium">{folder.name}</span>
                      <span className="text-sm opacity-70">
                        ({notesData.notes.filter(n => n.folderId === folder.id).length})
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(folder.id);
                      }}
                      className="p-1 hover:bg-white/20 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* New Note Button */}
          {selectedFolder && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowNewNoteModal(true)}
                className="w-full bg-[#8CA4AF] text-white py-3 rounded-lg font-medium hover:bg-[#7A939F] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Note
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {selectedFolder ? (
            <>
              {/* Notes List */}
              {!selectedNote && (
                <div className="flex-1 overflow-y-auto">
                  {filteredNotes.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg font-medium mb-2">No notes yet</p>
                        <p className="text-sm">Create your first note to get started</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      {filteredNotes.map(note => (
                        <div
                          key={note.id}
                          className="p-4 border border-gray-200 rounded-lg mb-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setSelectedNote(note);
                            setIsEditing(false);
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium text-lg truncate">{note.title}</h3>
                            <span className="text-sm text-gray-500 ml-2">{formatDate(note.updatedAt)}</span>
                          </div>
                          <p className="text-gray-600 text-sm line-clamp-2">
                            {getNotePreview(note.content)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Note Editor */}
              {selectedNote && (
                <div className="flex-1 flex flex-col">
                  {/* Note Header */}
                  <div className="p-4 border-b border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setSelectedNote(null);
                            setIsEditing(false);
                            setSidebarCollapsed(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={selectedNote.title}
                              onChange={(e) => updateNote({ title: e.target.value })}
                              className="text-xl font-semibold bg-transparent border-none outline-none"
                              placeholder="Note title"
                            />
                          ) : (
                            <h2 className="text-xl font-semibold">{selectedNote.title}</h2>
                          )}
                          <p className="text-sm text-gray-500">{formatDate(selectedNote.updatedAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M4 6h16M4 12h16M4 18h16" : "M4 6h16M4 12h8m-8 6h16"} />
                          </svg>
                        </button>
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className="px-3 py-1.5 bg-[#8CA4AF] text-white rounded-lg hover:bg-[#7A939F] transition-colors"
                        >
                          {isEditing ? 'Done' : 'Edit'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(selectedNote.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Note Content */}
                  <div className="flex-1 p-4">
                    {isEditing ? (
                      <textarea
                        ref={textareaRef}
                        value={selectedNote.content}
                        onChange={(e) => updateNote({ content: e.target.value })}
                        className="w-full h-full resize-none border-none outline-none text-[#4E4034] leading-relaxed"
                        placeholder="Start writing your note..."
                      />
                    ) : (
                      <div className="w-full h-full whitespace-pre-wrap text-[#4E4034] leading-relaxed">
                        {selectedNote.content || <span className="text-gray-400 italic">Empty note</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                </svg>
                <p className="text-lg font-medium mb-2">Select a folder</p>
                <p className="text-sm">Choose a folder to view your notes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">New Folder</h3>
            <input
              ref={newFolderInputRef}
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-[#8CA4AF]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName("");
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                className="px-4 py-2 bg-[#8CA4AF] text-white rounded-lg hover:bg-[#7A939F] transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Note Modal */}
      {showNewNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">New Note</h3>
            <input
              ref={newNoteInputRef}
              type="text"
              placeholder="Note title"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createNote()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-[#8CA4AF]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewNoteModal(false);
                  setNewNoteTitle("");
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createNote}
                className="px-4 py-2 bg-[#8CA4AF] text-white rounded-lg hover:bg-[#7A939F] transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">
              {notesData.folders.find(f => f.id === showDeleteConfirm) ? 'Delete Folder' : 'Delete Note'}
            </h3>
            <p className="text-gray-600 mb-6">
              {notesData.folders.find(f => f.id === showDeleteConfirm) 
                ? 'This will delete the folder and all notes inside it. This action cannot be undone.'
                : 'This note will be permanently deleted. This action cannot be undone.'
              }
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (notesData.folders.find(f => f.id === showDeleteConfirm)) {
                    deleteFolder(showDeleteConfirm);
                  } else {
                    deleteNote(showDeleteConfirm);
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
