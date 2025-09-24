"use client";
import { useEffect, useState, useRef, useMemo, Suspense } from "react";
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

// Load notes from localStorage (week-specific)
function loadNotes() {
  try {
    const weekKey = getCurrentWeekKey();
    const raw = localStorage.getItem(`notesAppData:week:${weekKey}`);
    console.log("Raw data from localStorage for week", weekKey, ":", raw);
    const data = raw ? JSON.parse(raw) : { folders: [], notes: [] };
    console.log("Parsed notes data:", data);
    return {
      folders: Array.isArray(data.folders) ? data.folders : [],
      notes: Array.isArray(data.notes) ? data.notes : []
    };
  } catch (e) {
    console.warn("Failed to load notes:", e);
    return { folders: [], notes: [] };
  }
}

// Save notes to localStorage (week-specific)
function saveNotes(data) {
  try {
    const weekKey = getCurrentWeekKey();
    console.log("Saving notes to localStorage for week", weekKey, ":", data);
    localStorage.setItem(`notesAppData:week:${weekKey}`, JSON.stringify(data));
    console.log("Successfully saved notes to localStorage");
  } catch (e) {
    console.warn("Failed to save notes:", e);
  }
}

// Default folders
const FOCUS_AREAS_FOLDER = "Focus Areas";

// Get current week key (Monday of current week)
function getCurrentWeekKey() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  monday.setHours(0, 0, 0, 0);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

// Load focus areas from weekly snapshot
function loadFocusAreas() {
  try {
    const weekKey = getCurrentWeekKey();
    const raw = localStorage.getItem(`focusCategories:week:${weekKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    // Fallback to global focus categories if no weekly snapshot exists
    const globalRaw = localStorage.getItem("focusCategories");
    const globalParsed = globalRaw ? JSON.parse(globalRaw) : [];
    return Array.isArray(globalParsed) ? globalParsed : [];
  } catch {
    return [];
  }
}

// Handle focus area renames by updating existing folders
function handleFocusAreaRenames(currentAreas, currentFolders) {
  const updatedFolders = [...currentFolders];
  let hasChanges = false;

  // Find focus area subfolders (those with parentFolderId pointing to Focus Areas folder)
  const focusAreasFolder = updatedFolders.find(f => f.name === FOCUS_AREAS_FOLDER);
  if (!focusAreasFolder) return { updatedFolders, hasChanges };

  const focusAreaSubfolders = updatedFolders.filter(f => f.parentFolderId === focusAreasFolder.id);
  
  // Check each current focus area
  currentAreas.forEach(area => {
    // Find if there's an existing subfolder for this focus area
    let existingSubfolder = focusAreaSubfolders.find(f => f.name === area.label);
    
    if (!existingSubfolder) {
      // Check if there's a subfolder with a different name that might be the renamed version
      // This is a simple approach - in a real app you'd want more sophisticated matching
      const orphanedSubfolder = focusAreaSubfolders.find(f => 
        !currentAreas.some(area => area.label === f.name)
      );
      
      if (orphanedSubfolder) {
        // Update the orphaned folder's name to match the current focus area
        orphanedSubfolder.name = area.label;
        orphanedSubfolder.color = area.color || "#8CA4AF";
        hasChanges = true;
      }
    }
  });

  return { updatedFolders, hasChanges };
}

// Notes content component that uses useSearchParams
function NotesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = useClientOnly(); // Add client-side only rendering
  const [notesData, setNotesData] = useState({ folders: [], notes: [] });
  const [focusAreas, setFocusAreas] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [noteToRename, setNoteToRename] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const textareaRef = useRef(null);
  const newFolderInputRef = useRef(null);
  const newNoteInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const titleInputRef = useRef(null);

  // Get focus area from URL params
  const focusArea = searchParams?.get('focus') || '';

  // Load data on mount
  useEffect(() => {
    if (!isClient) return; // Don't run on server
    const data = loadNotes();
    const areas = loadFocusAreas();
    setFocusAreas(areas);
    
    // Clean up duplicate focus area folders (keep only those that are subfolders)
    let cleanedFolders = data.folders.filter(folder => {
      // Keep Focus Areas folder
      if (folder.name === FOCUS_AREAS_FOLDER) return true;
      // Keep folders that are NOT focus areas
      if (!areas.some(area => area.label === folder.name)) return true;
      // Keep focus area folders that have notes (don't delete folders with content)
      if (data.notes.some(note => note.folderId === folder.id)) return true;
      // Remove empty standalone focus area folders (they should only exist as subfolders)
      return false;
    });
    
    // Ensure Focus Areas folder exists (top-level)
    let focusAreasFolder = cleanedFolders.find(f => f.name === FOCUS_AREAS_FOLDER && !f.parentFolderId);
    if (!focusAreasFolder) {
      focusAreasFolder = {
        id: makeId(),
        name: FOCUS_AREAS_FOLDER,
        color: "#8CA4AF",
        createdAt: Date.now()
      };
      cleanedFolders.unshift(focusAreasFolder);
    }
    
    // Handle focus area renames
    const { updatedFolders, hasChanges: renameChanges } = handleFocusAreaRenames(areas, cleanedFolders);
    let hasChanges = renameChanges;
    cleanedFolders = updatedFolders;
    
    // Ensure all focus area subfolders exist
    areas.forEach(area => {
      let focusAreaSubfolder = cleanedFolders.find(f => f.name === area.label && f.parentFolderId === focusAreasFolder.id);
      if (!focusAreaSubfolder) {
        focusAreaSubfolder = {
          id: makeId(),
          name: area.label,
          color: area.color || "#8CA4AF",
          parentFolderId: focusAreasFolder.id,
          createdAt: Date.now()
        };
        cleanedFolders.push(focusAreaSubfolder);
        hasChanges = true;
      }
    });
    
    // Migrate notes from old standalone focus area folders to new subfolders
    const notesToUpdate = [];
    data.notes.forEach(note => {
      const noteFolder = cleanedFolders.find(f => f.id === note.folderId);
      if (noteFolder && !noteFolder.parentFolderId && areas.some(area => area.label === noteFolder.name)) {
        // This note is in a standalone focus area folder, migrate it to the subfolder
        const targetSubfolder = cleanedFolders.find(f => f.name === noteFolder.name && f.parentFolderId === focusAreasFolder.id);
        if (targetSubfolder) {
          notesToUpdate.push({ ...note, folderId: targetSubfolder.id });
          hasChanges = true;
        }
      }
    });
    
    // Update notes with new folder IDs
    if (notesToUpdate.length > 0) {
      const updatedNotes = data.notes.map(note => {
        const updatedNote = notesToUpdate.find(n => n.id === note.id);
        return updatedNote || note;
      });
      data.notes = updatedNotes;
      hasChanges = true;
    }
    
    // Update data if we made changes
    if (hasChanges || cleanedFolders.length !== data.folders.length) {
      const updatedData = { ...data, folders: cleanedFolders };
      setNotesData(updatedData);
      saveNotes(updatedData);
    } else {
      setNotesData(data);
    }
    
    // If coming from focus area, select the specific focus area subfolder
    if (focusArea) {
      // Find or create the specific focus area subfolder as a child of Focus Areas
      let focusAreaSubfolder = cleanedFolders.find(f => f.name === focusArea && f.parentFolderId === focusAreasFolder.id);
      if (!focusAreaSubfolder) {
        focusAreaSubfolder = {
          id: makeId(),
          name: focusArea,
          color: "#8CA4AF",
          parentFolderId: focusAreasFolder.id, // Make it a child of Focus Areas
          createdAt: Date.now()
        };
        cleanedFolders.push(focusAreaSubfolder);
        const updatedData = { ...data, folders: cleanedFolders };
        setNotesData(updatedData);
        saveNotes(updatedData);
      }
      setSelectedFolder(focusAreaSubfolder.id);
    }
  }, [focusArea, isClient]);

  // Listen for focus area changes (both global and weekly)
  useEffect(() => {
    if (!isClient) return; // Don't run on server
    const handleStorageChange = (e) => {
      const weekKey = getCurrentWeekKey();
      if (e.key === "focusCategories" || e.key === `focusCategories:week:${weekKey}`) {
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
      setNotesData(prevData => {
        const updatedNotes = prevData.notes.map(note => 
          note.id === selectedNote.id ? selectedNote : note
        );
        const updatedData = { ...prevData, notes: updatedNotes };
        saveNotes(updatedData);
        return updatedData;
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [selectedNote, isEditing, isClient]);

  // Focus textarea when editing and collapse sidebar
  useEffect(() => {
    if (!isClient || !isEditing || !textareaRef.current) return; // Don't run on server
    textareaRef.current.focus();
    setSidebarCollapsed(true);
  }, [isEditing, isClient]);

  // Focus new folder input when modal opens

  // Focus new note input when modal opens
  useEffect(() => {
    if (!isClient || !showNewNoteModal || !newNoteInputRef.current) return; // Don't run on server
    newNoteInputRef.current.focus();
  }, [showNewNoteModal, isClient]);

  // Focus rename input when modal opens
  useEffect(() => {
    if (!isClient || !showRenameModal || !renameInputRef.current) return; // Don't run on server
    renameInputRef.current.focus();
  }, [showRenameModal, isClient]);

  // Focus title input when editing starts
  useEffect(() => {
    if (!isClient || !isEditingTitle || !titleInputRef.current) return; // Don't run on server
    titleInputRef.current.focus();
    titleInputRef.current.select(); // Select all text for easy editing
  }, [isEditingTitle, isClient]);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    if (!isClient) return;
    
    const handleClickOutside = (event) => {
      // Close all dropdown menus (no main view menus anymore)
      const menus = document.querySelectorAll('[id^="menu-"]');
      menus.forEach(menu => {
        if (menu.style.display === 'block') {
          menu.style.display = 'none';
        }
      });
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isClient]);

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
        <header className="bg-white border-b border-gray-200 px-4 pt-16 pb-3">
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
          </div>
        </header>
        
        <div className="flex h-[calc(100vh-109px)]">
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
    if (!selectedFolder) {
      console.log("No selected folder, cannot create note");
      return;
    }
    
    const title = newNoteTitle.trim() || "New Note";
    
    const newNote = {
      id: makeId(),
      title: title,
      content: "",
      folderId: selectedFolder,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    console.log("Creating note:", newNote);
    console.log("Selected folder ID:", selectedFolder);
    console.log("Current notes data:", notesData);
    
    const updatedData = {
      ...notesData,
      notes: [newNote, ...notesData.notes]
    };
    
    console.log("Updated data:", updatedData);
    
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

  // Handle auto-list functionality
  const handleTextareaInput = (e) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    // Find the start of the current line
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n');
    const currentLineStart = lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
    const currentLine = value.substring(currentLineStart, cursorPosition);
    
    // Check if the current line starts with "- " (hyphen + space)
    if (currentLine.match(/^- $/)) {
      // Replace "- " with "• " (bullet point)
      const newValue = value.substring(0, currentLineStart) +
                       currentLine.replace(/^- $/, '• ') +
                       value.substring(cursorPosition);
      
      // Update the note content
      updateNote({ content: newValue });
      
      // Set cursor position after the bullet point
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = currentLineStart + 2; // After "• "
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    } else {
      // Normal update
      updateNote({ content: value });
    }
  };

  // Rename note
  const renameNote = () => {
    const noteToRenameId = noteToRename?.id || selectedNote?.id;
    const newTitle = renameTitle.trim() || editingTitle.trim();
    
    if (!noteToRenameId || !newTitle) return;
    
    const updatedData = {
      ...notesData,
      notes: notesData.notes.map(note => 
        note.id === noteToRenameId 
          ? { ...note, title: newTitle, updatedAt: Date.now() }
          : note
      )
    };
    
    setNotesData(updatedData);
    saveNotes(updatedData);
    
    // Update selectedNote if it's the one being renamed
    if (selectedNote && selectedNote.id === noteToRenameId) {
      setSelectedNote({ ...selectedNote, title: newTitle, updatedAt: Date.now() });
    }
    
    // Reset all editing states
    setShowRenameModal(false);
    setRenameTitle("");
    setNoteToRename(null);
    setIsEditingTitle(false);
    setEditingTitle("");
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
      
      // Go back to main focus areas view - select the Focus Areas folder
      const focusAreasFolder = notesData.folders.find(f => f.name === FOCUS_AREAS_FOLDER && !f.parentFolderId);
      if (focusAreasFolder) {
        setSelectedFolder(focusAreasFolder.id);
      } else {
        setSelectedFolder(null);
      }
      
      // Expand sidebar to show focus areas
      setSidebarCollapsed(false);
    }
  };

  // Create new folder

  // Delete folder
  const deleteFolder = (folderId) => {
    // Get all child folders recursively
    const getAllChildFolders = (parentId) => {
      const directChildren = notesData.folders.filter(f => f.parentFolderId === parentId);
      let allChildren = [...directChildren];
      directChildren.forEach(child => {
        allChildren = [...allChildren, ...getAllChildFolders(child.id)];
      });
      return allChildren;
    };
    
    const childFolders = getAllChildFolders(folderId);
    const allFolderIdsToDelete = [folderId, ...childFolders.map(f => f.id)];
    
    const updatedData = {
      ...notesData,
      folders: notesData.folders.filter(f => !allFolderIdsToDelete.includes(f.id)),
      notes: notesData.notes.filter(note => !allFolderIdsToDelete.includes(note.folderId))
    };
    setNotesData(updatedData);
    saveNotes(updatedData);
    
    if (allFolderIdsToDelete.includes(selectedFolder)) {
      setSelectedFolder(null);
      setSelectedNote(null);
      setIsEditing(false);
    }
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

  // Format text with basic markdown-like formatting
  const formatText = (text) => {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/__(.*?)__/g, '<u>$1</u>') // Underline
      .replace(/^- (.*$)/gm, '<li class="list-disc ml-4">$1</li>') // Bullet points
      .replace(/^\d+\. (.*$)/gm, '<li class="list-decimal ml-4">$1</li>') // Numbered lists
      .replace(/\n/g, '<br>'); // Line breaks
  };



  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#4E4034]">
      {/* Header */}
      <header className="bg-[#F7F6F3] border-b border-gray-200 px-4 pt-16 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedNote) {
                  if (isEditing) {
                    setIsEditing(false); // This will trigger auto-save via useEffect
                  }
                  setSelectedNote(null);
                  setSidebarCollapsed(false);
                } else {
                  router.back();
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {selectedNote ? (
              <h1 className="text-xl font-semibold">
                {(() => {
                  const noteFolder = notesData.folders.find(f => f.id === selectedNote.folderId);
                  if (noteFolder) {
                    // Show the actual folder name (e.g., "School" for focus area subfolders)
                    return noteFolder.name;
                  }
                  return "Notes";
                })()}
              </h1>
            ) : (
              <h1 className="text-xl font-semibold">Notes</h1>
            )}
          </div>
          {selectedNote && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(selectedNote.id)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Delete note"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-109px)]">
        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out`}>
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
              {/* Focus Areas as main folder */}
              {notesData.folders
                .filter(folder => folder.name === FOCUS_AREAS_FOLDER && !folder.parentFolderId)
                .map(folder => (
                  <div key={folder.id}>
                    <div className="flex items-center justify-between p-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{folder.name}</span>
                        <span className="text-sm opacity-70">
                          ({focusAreas.length})
                        </span>
                      </div>
                      {/* Focus Areas folder cannot be deleted */}
                    </div>
                    
                    {/* Individual focus area subfolders */}
                    {focusAreas.map(area => {
                      let subfolder = notesData.folders.find(f => f.name === area.label && f.parentFolderId === folder.id);
                      
                      // Create subfolder if it doesn't exist
                      if (!subfolder) {
                        subfolder = {
                          id: makeId(),
                          name: area.label,
                          color: area.color || "#8CA4AF",
                          parentFolderId: folder.id, // Focus area subfolders are children of Focus Areas
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
                        <div key={area.label}>
                          <div
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
                              <svg 
                                className="w-4 h-4" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                                style={{ color: area.color || "#8CA4AF" }}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                              </svg>
                              <span className="font-medium text-sm">{area.label}</span>
                              <span className="text-xs opacity-70">
                                ({noteCount})
                              </span>
                            </div>
                            {/* Focus area subfolders cannot be deleted */}
                          </div>
                    
                        </div>
                      );
                    })}
                    
                  </div>
                ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            {selectedFolder && focusAreas.some(area => {
              const subfolder = notesData.folders.find(f => f.name === area.label && f.parentFolderId === notesData.folders.find(f => f.name === FOCUS_AREAS_FOLDER && !f.parentFolderId)?.id);
              return subfolder && subfolder.id === selectedFolder;
            }) && (
              <button
                onClick={() => {
                  console.log('New Note button clicked, selectedFolder:', selectedFolder);
                  setShowNewNoteModal(true);
                }}
                className="w-full bg-[#8CA4AF] text-white py-3 rounded-lg font-medium hover:bg-[#7A939F] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Note
              </button>
            )}
          </div>
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
                          className="p-4 border border-gray-200 rounded-lg mb-3 hover:bg-gray-50 transition-colors relative"
                        >
                          <div 
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedNote(note);
                              setIsEditing(false);
                              setSidebarCollapsed(true);
                            }}
                          >
                            <div className="mb-2">
                              <h3 className="font-medium text-lg mb-1">{note.title}</h3>
                              <span className="text-sm text-gray-500">{formatDate(note.updatedAt)}</span>
                            </div>
                            <p className="text-gray-600 text-sm line-clamp-2">
                              {getNotePreview(note.content)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Note Editor */}
              {selectedNote && (
                <div className="flex-1 flex flex-col">
                  {/* Note Title */}
                  <div className="p-4">
                    {isEditingTitle ? (
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => {
                          if (editingTitle.trim()) {
                            renameNote();
                          } else {
                            setEditingTitle(selectedNote.title);
                            setIsEditingTitle(false);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            if (editingTitle.trim()) {
                              renameNote();
                            } else {
                              setEditingTitle(selectedNote.title);
                              setIsEditingTitle(false);
                            }
                          }
                        }}
                        className="text-xl font-semibold text-[#4E4034] w-full bg-transparent border-none outline-none"
                        autoFocus
                      />
                    ) : (
                      <h2 
                        className="text-xl font-semibold text-[#4E4034] cursor-text hover:bg-gray-50 p-1 rounded"
                        onClick={() => {
                          setEditingTitle(selectedNote.title);
                          setIsEditingTitle(true);
                        }}
                        title="Tap to edit title"
                      >
                        {selectedNote.title}
                      </h2>
                    )}
                  </div>
                  
                  {/* Note Content Area */}
                  <div className="flex-1 p-4">
                    {isEditing ? (
                      <textarea
                        ref={textareaRef}
                        value={selectedNote.content}
                        onChange={handleTextareaInput}
                        onBlur={() => setIsEditing(false)}
                        className="w-full h-full resize-none border-none outline-none text-[#4E4034] bg-transparent"
                        placeholder="Start writing your note..."
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => setIsEditing(true)}
                        className="w-full h-full cursor-text text-[#4E4034]"
                        dangerouslySetInnerHTML={{ __html: formatText(selectedNote.content) }}
                      />
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
                <p className="text-lg font-medium mb-2">No note selected</p>
                <p className="text-sm">Choose a note from the sidebar to start editing</p>
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* Rename Note Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">Rename Note</h3>
            <input
              ref={renameInputRef}
              type="text"
              placeholder="Note title"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && renameNote()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-[#8CA4AF]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameTitle("");
                  setNoteToRename(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={renameNote}
                className="px-4 py-2 bg-[#8CA4AF] text-white rounded-lg hover:bg-[#7A939F] transition-colors"
              >
                Rename
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
                  // Close modal immediately
                  setShowDeleteConfirm(null);
                  
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

// Main notes page - client-side only
export default function NotesPage() {
  const isClient = useClientOnly();
  
  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2 text-[#4E4034]">Loading Notes...</div>
          <div className="text-sm text-gray-500">Please wait while we prepare your notes.</div>
        </div>
      </div>
    );
  }
  
  return <NotesContent />;
}
