import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { title, type, author } = await request.json();
    
    if (!title || !type) {
      return NextResponse.json({ error: 'Title and type are required' }, { status: 400 });
    }

    let imageUrl = null;

    try {
      if (type === 'book') {
        // Try to find book cover using Google Books API
        const searchQuery = encodeURIComponent(`${title} ${author || ''}`.trim());
        const googleBooksResponse = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${searchQuery}&maxResults=1`
        );
        
        if (googleBooksResponse.ok) {
          const data = await googleBooksResponse.json();
          if (data.items && data.items.length > 0) {
            const book = data.items[0];
            const imageLinks = book.volumeInfo?.imageLinks;
            if (imageLinks) {
              // Try different image sizes, preferring larger ones
              imageUrl = imageLinks.thumbnail?.replace('zoom=1', 'zoom=2') || 
                        imageLinks.smallThumbnail?.replace('zoom=1', 'zoom=2') ||
                        imageLinks.thumbnail || 
                        imageLinks.smallThumbnail;
            }
          }
        }
      } else if (type === 'podcast') {
        // For podcasts, try to find cover art using iTunes API
        const searchQuery = encodeURIComponent(title);
        const itunesResponse = await fetch(
          `https://itunes.apple.com/search?term=${searchQuery}&media=podcast&limit=1`
        );
        
        if (itunesResponse.ok) {
          const data = await itunesResponse.json();
          if (data.results && data.results.length > 0) {
            const podcast = data.results[0];
            imageUrl = podcast.artworkUrl600 || podcast.artworkUrl100;
          }
        }
      } else if (type === 'social') {
        // For social media, we'll use a more generic approach
        // This could be enhanced to use actual platform APIs
        const searchQuery = encodeURIComponent(title);
        const unsplashResponse = await fetch(
          `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=1&orientation=square`,
          {
            headers: {
              'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || 'demo'}`
            }
          }
        );
        
        if (unsplashResponse.ok) {
          const data = await unsplashResponse.json();
          if (data.results && data.results.length > 0) {
            imageUrl = data.results[0].urls.small;
          }
        }
      }

      // If we found an image, return it
      if (imageUrl) {
        return NextResponse.json({ 
          imageUrl,
          source: type === 'book' ? 'google-books' : type === 'podcast' ? 'itunes' : 'unsplash'
        });
      }

    } catch (apiError) {
      console.log(`API error for ${type}:`, apiError.message);
    }

    // Fallback to Unsplash based on type
    const fallbackQueries = {
      book: ['book cover', 'reading', 'library'],
      podcast: ['podcast', 'microphone', 'audio'],
      social: ['social media', 'profile', 'user']
    };

    const fallbackQuery = fallbackQueries[type]?.[0] || 'placeholder';
    
    try {
      const unsplashResponse = await fetch(
        `https://api.unsplash.com/search/photos?query=${fallbackQuery}&per_page=1&orientation=square`,
        {
          headers: {
            'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || 'demo'}`
          }
        }
      );
      
      if (unsplashResponse.ok) {
        const data = await unsplashResponse.json();
        if (data.results && data.results.length > 0) {
          imageUrl = data.results[0].urls.small;
        }
      }
    } catch (unsplashError) {
      console.log('Unsplash fallback error:', unsplashError.message);
    }

    // Final fallback to static Unsplash URLs
    const staticFallbacks = {
      book: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop',
      podcast: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop',
      social: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200&h=200&fit=crop'
    };

    imageUrl = imageUrl || staticFallbacks[type] || staticFallbacks.book;

    return NextResponse.json({ 
      imageUrl,
      source: 'fallback'
    });

  } catch (error) {
    console.error('Cover image API error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch cover image',
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop'
    }, { status: 500 });
  }
}
