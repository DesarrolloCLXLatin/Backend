import React from 'react';
import { IframeTicketPurchaseForm } from '../Tickets/IframeTicketPurchase';
const EmbeddableTicketForm = () => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // Get token from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const startExperience = async () => {
    setIsLoading(true);
    try {
      if (audioRef.current) {
        await audioRef.current.play();
        setIsPlaying(true);
        setHasInteracted(true);
      }
    } catch (error) {
      console.log('Error al reproducir:', error);
      // Si falla, igual permite continuar sin música
      setHasInteracted(true);
    }
    setIsLoading(false);
  };

  const toggleMusic = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.log);
      }
      setIsPlaying(!isPlaying);
    }
  };

  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
    }

    // Send ready message to parent
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'IFRAME_READY' }, '*');
    }
  }, []);

  const handleSuccess = () => {
    setShowSuccess(true);
    // Notificar al padre si está embebido
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'TICKET_PURCHASE_SUCCESS' }, '*');
    }
    // Scroll al top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pantalla de éxito
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center animate-fadeIn max-w-md">
          <div className="mb-8">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600">
              ¡Compra Exitosa!
            </span>
          </h2>
          
          <p className="text-gray-300 text-lg mb-8">
            Tu solicitud de compra ha sido registrada correctamente.
          </p>

          <div className="bg-gray-900 rounded-2xl p-6 mb-8 text-left">
            <h3 className="text-white font-semibold mb-3">Próximos pasos:</h3>
            <ol className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-red-400">1.</span>
                <span>Revisa tu email para las instrucciones de pago</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">2.</span>
                <span>Realiza el pago móvil con los datos proporcionados</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">3.</span>
                <span>Recibirás tus entradas por email una vez confirmado el pago</span>
              </li>
            </ol>
          </div>

          <button
            onClick={() => {
              setShowSuccess(false);
              setHasInteracted(false);
            }}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-full font-bold text-white shadow-lg hover:shadow-red-500/50 transform hover:scale-105 transition-all duration-300"
          >
            Comprar Más Entradas
          </button>
        </div>
      </div>
    );
  }

  // Pantalla de bienvenida
  if (!hasInteracted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <audio 
          ref={audioRef}
          loop
          className="hidden"
        >
          <source src="/soundTrack.mp3" type="audio/mpeg" />
        </audio>

        <div className="relative text-center animate-fadeIn -top-96 mb-96 w-11/12 h-96">
          {/* Logo con efecto */}
          <div className="mb-8 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#FD8D6A] to-[#FD8D6A] blur-3xl opacity-30 animate-pulse" />
            <div className="relative inline-block p-6 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-3xl backdrop-blur-sm border border-red-500/30">
              <img
                src="/clxrun.png"
                alt='Logo'
                className="h-32 w-72 mx-auto drop-shadow-2xl"
              />
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-black mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-[#FD8D6A] to-orange-400">
              Caramelos de Cianuro
            </span>
          </h1>
          
          <p className="text-red-400/60 text-lg mb-8">
            Post-Carrera
          </p>

          <button
            onClick={startExperience}
            disabled={isLoading || !token}
            className="group relative px-8 py-4 bg-gradient-to-r from-red-500 to-orange-500 rounded-full font-bold text-white text-lg shadow-lg hover:shadow-red-500/50 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center gap-3">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Cargando...
                </>
              ) : !token ? (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Token Requerido
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Comprar Entradas
                </>
              )}
            </span>
            <div className="absolute inset-0 bg-white rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
          </button>

          {!token && (
            <p className="mt-4 text-red-400 text-sm">
              Este formulario requiere un token de acceso válido
            </p>
          )}
        </div>

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-fadeIn {
            animation: fadeIn 0.8s ease-out;
          }
        `}</style>
      </div>
    );
  }

  // Contenido principal
  return (
    <div className="min-h-screen bg-black p-4 relative overflow-hidden">
      {/* Audio de fondo */}
      <audio 
        ref={audioRef}
        loop
        className="hidden"
      >
        <source src="/soundTrack.mp3" type="audio/mpeg" />
      </audio>

      {/* Botón de control de música */}
      <button
        onClick={toggleMusic}
        className="fixed top-4 right-4 z-50 p-3 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-full hover:bg-red-500/30 transition-all duration-300 group"
        aria-label={isPlaying ? "Pausar música" : "Reproducir música"}
      >
        <div className="relative">
          {isPlaying ? (
            <>
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {/* Indicador visual de música activa */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse" />
            </>
          ) : (
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        
        {/* Tooltip */}
        <span className="absolute right-full mr-2 px-2 py-1 bg-black/80 text-red-400 text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          {isPlaying ? 'Pausar música' : 'Reproducir música'}
        </span>
      </button>
    
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-black to-black pointer-events-none" />
      
      {/* Animated Background Circles */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-2000" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-red-400 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000" />
      
      {/* Particle Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-red-400 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${10 + Math.random() * 20}s`
            }}
          />
        ))}
      </div>
      
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-8">
          {/* Logo with glow effect */}
          <div className="mb-8 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#FD8D6A] to-[#FD8D6A] blur-3xl opacity-30 animate-pulse" />
            <div className="relative inline-block p-8 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-3xl backdrop-blur-sm border border-red-500/30">
              <img
                src="/clxrun.png"
                alt='Logo'
                className="h-40 w-96 mx-auto mb-8 drop-shadow-2xl"
              />
            </div>
          </div>
          
          {/* Title with animations */}
          <h1 className="text-4xl md:text-6xl font-black mb-4 relative">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-[#FD8D6A] to-orange-400 animate-pulse">
              Entrada para
            </span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-red-300 text-5xl md:text-7xl animate-pulse animation-delay-500">
              Caramelos de Cianuro
            </span>
          </h1>
          
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-red-400 animate-pulse" />
            <p className="text-red-400/80 text-lg md:text-xl font-light tracking-[0.2em] uppercase animate-pulse">
              Post-Carrera
            </p>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-red-400 animate-pulse" />
          </div>
          
          <p className="text-red-300/60 text-base md:text-lg font-light italic">
            ¡No te pierdas el mejor concierto después de la carrera!
          </p>
        </div>
        
        <div className="animate-fadeIn">
          <IframeTicketPurchaseForm 
            isEmbedded={true}
            onSuccess={handleSuccess}
            token={token}
          />
        </div>
      </div>

      <style>{`
        @keyframes float {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(50px);
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-float {
          animation: float linear infinite;
        }

        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animation-delay-500 {
          animation-delay: 0.5s;
        }
      `}</style>
    </div>
  );
};

export default EmbeddableTicketForm;