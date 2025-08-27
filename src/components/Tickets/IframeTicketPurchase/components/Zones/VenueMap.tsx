import React, { useState, useEffect } from 'react';
import { MapPin, Users, Star, Info, Music, Loader2, AlertCircle, Crown, Check } from 'lucide-react';

interface Box {
  id: string;
  code: string;
  number: string;
  status: 'available' | 'sold' | 'reserved' | 'blocked' | 'maintenance';
  capacity: number;
  price_usd: number;
  floor_level: number;
  position: {
    x: number;
    y: number;
  };
  amenities?: string[];
  available_seats: number;
  sold_to?: string | null;
}

interface Zone {
  id: string;
  code: string;
  name: string;
  type: string;
  price_usd: number;
  capacity: number;
  color: string;
  icon?: string;
  description?: string;
}

interface VenueStats {
  venue: {
    total_capacity: number;
    total_sold: number;
    total_available: number;
  };
  boxes: {
    summary: {
      total_boxes: number;
      sold_boxes: number;
      reserved_boxes: number;
      available_boxes: number;
    };
    detail: Box[];
  };
  general: {
    capacity: number;
    sold: number;
    available: number;
    price_usd: number;
  };
  zones: Zone[];
}

interface VenueMapProps {
  onSelectZone: (zoneType: 'preferencial' | 'box', boxNumber?: string) => void;
  selectedZone: string | null;
  selectedBox: string | null;
  apiUrl?: string;
  token?: string;
}

const VenueMap: React.FC<VenueMapProps> = ({ 
  onSelectZone, 
  selectedZone, 
  selectedBox,
  apiUrl = '/api/boxes',
  token
}) => {
  const [hoveredBox, setHoveredBox] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venueData, setVenueData] = useState<VenueStats | null>(null);
  const [selectedBoxData, setSelectedBoxData] = useState<Box | null>(null);

  // Datos estáticos de respaldo si el API falla
  const staticBoxes: Box[] = Array.from({ length: 30 }, (_, i) => ({
    id: `B${i + 1}`,
    code: `B${i + 1}`,
    number: `Box ${i + 1}`,
    status: i < 10 ? 'sold' : 'available',
    capacity: 10,
    price_usd: 75,
    floor_level: i >= 20 ? 2 : 1,
    position: {
      x: (i % 10) * 80 + 50,
      y: Math.floor(i / 10) * 100 + 100
    },
    amenities: i < 10 
      ? ["Vista privilegiada frontal", "Servicio de bebidas premium", "Acceso VIP", "Baño privado"] 
      : ["Vista privilegiada", "Servicio de bebidas", "Acceso VIP"],
    available_seats: i < 10 ? 0 : 10,
    sold_to: i < 10 ? `Cliente Corporativo ${i + 1}` : null
  }));

  // Fetch venue data from backend
  useEffect(() => {
    fetchVenueData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchVenueData, 30000);
    return () => clearInterval(interval);
  }, [apiUrl, token]);

  const fetchVenueData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Si no hay API URL, usar datos estáticos
      if (!apiUrl) {
        setVenueData({
          venue: {
            total_capacity: 5000,
            total_sold: 100,
            total_available: 4900
          },
          boxes: {
            summary: {
              total_boxes: 30,
              sold_boxes: 10,
              reserved_boxes: 0,
              available_boxes: 20
            },
            detail: staticBoxes
          },
          general: {
            capacity: 4700,
            sold: 0,
            available: 4700,
            price_usd: 35
          },
          zones: []
        });
        setLoading(false);
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}/availability`, { headers });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Asegurar que los boxes estén ordenados correctamente
        if (data.boxes && data.boxes.detail) {
          data.boxes.detail.sort((a: Box, b: Box) => {
            const numA = parseInt(a.code.replace('B', ''));
            const numB = parseInt(b.code.replace('B', ''));
            return numA - numB;
          });
        }
        setVenueData(data);
      } else {
        throw new Error(data.message || 'Error al cargar datos del venue');
      }
    } catch (err) {
      console.error('Error fetching venue data:', err);
      // Si hay error, usar datos estáticos
      setVenueData({
        venue: {
          total_capacity: 5000,
          total_sold: 100,
          total_available: 4900
        },
        boxes: {
          summary: {
            total_boxes: 30,
            sold_boxes: 10,
            reserved_boxes: 0,
            available_boxes: 20
          },
          detail: staticBoxes
        },
        general: {
          capacity: 4700,
          sold: 0,
          available: 4700,
          price_usd: 35
        },
        zones: []
      });
      setError(err instanceof Error ? err.message : 'Error al cargar el mapa del venue');
    } finally {
      setLoading(false);
    }
  };

  const getBoxColor = (box: Box) => {
    if (selectedBox === box.code) {
      return 'bg-gradient-to-b from-green-500 to-green-600 ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900 shadow-lg shadow-green-500/50';
    }
    
    switch (box.status) {
      case 'sold':
        return 'bg-gray-700 opacity-50 cursor-not-allowed';
      case 'reserved':
        return 'bg-gradient-to-b from-yellow-600 to-yellow-700 opacity-75 cursor-not-allowed';
      case 'blocked':
      case 'maintenance':
        return 'bg-gradient-to-b from-red-700 to-red-800 opacity-50 cursor-not-allowed';
      default:
        if (hoveredBox === box.code) {
          return 'bg-gradient-to-b from-[#ff8b6a] to-[#ff6b4a] shadow-lg shadow-orange-500/50 transform scale-110';
        }
        return 'bg-gradient-to-b from-[#FD8D6A] to-[#ff6b4a] hover:from-[#ff7b5a] hover:to-[#ff5b3a]';
    }
  };

  const getBoxStatusText = (status: string) => {
    switch (status) {
      case 'sold': return 'VENDIDO';
      case 'reserved': return 'RESERVADO';
      case 'blocked': return 'BLOQUEADO';
      case 'maintenance': return 'MANTEN.';
      default: return '';
    }
  };

  const handleBoxClick = (box: Box) => {
    if (box.status === 'available') {
      setSelectedBoxData(box);
      onSelectZone('box', box.code);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#FD8D6A] animate-spin mx-auto mb-4" />
            <p className="text-white">Cargando mapa del venue...</p>
          </div>
        </div>
      </div>
    );
  }

  const boxes = venueData?.boxes?.detail || staticBoxes;
  const generalZone = venueData?.general || { capacity: 4700, available: 4700, sold: 0, price_usd: 35 };
  const boxSummary = venueData?.boxes?.summary || { total_boxes: 30, available_boxes: 20, sold_boxes: 10 };

  // Organizar boxes en 3 filas de 10
  const firstRow = boxes.slice(0, 10);   // B1-B10
  const secondRow = boxes.slice(10, 20); // B11-B20
  const thirdRow = boxes.slice(20, 30);  // B21-B30

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Estadísticas generales */}
      {venueData && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-gray-400 text-sm">Capacidad Total</p>
            <p className="text-white text-2xl font-bold">{venueData.venue.total_capacity.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm">Vendidos</p>
            <p className="text-green-400 text-2xl font-bold">{venueData.venue.total_sold.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm">Disponibles</p>
            <p className="text-[#FD8D6A] text-2xl font-bold">{venueData.venue.total_available.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Mapa del Venue */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl">
        {/* Escenario */}
        <div className="mb-6">
          <div className="bg-black text-white py-6 rounded-t-2xl text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-black"></div>
            <div className="relative z-10">
              <Music className="w-8 h-8 mx-auto mb-2 text-purple-400" />
              <h3 className="text-2xl font-bold tracking-wider">ESCENARIO</h3>
              <p className="text-sm text-gray-300 mt-1">Caramelos de Cianuro</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-pulse"></div>
          </div>
        </div>

        {/* Zona de Boxes */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-[#FD8D6A] to-[#ff6b4a] text-white px-4 py-2 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-64">
                <Crown className="w-7 h-7 right-64" />
                <h4 className="font-bold text-xl">ZONA BOX PREMIUM</h4>
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">
                {boxSummary.available_boxes} de {boxSummary.total_boxes} disponibles
              </span>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-b-lg space-y-2">
            {/* Primera Fila - B1 a B10 (más cerca del escenario) */}
            <div className="text-center mb-1">
              <span className="text-xs text-gray-500">Primera Fila - Frente al escenario</span>
            </div>
            <div className="flex justify-center gap-2">
              {firstRow.map(box => (
                <div key={box.code} className="relative">
                  <button
                    onClick={() => handleBoxClick(box)}
                    onMouseEnter={() => setHoveredBox(box.code)}
                    onMouseLeave={() => setHoveredBox(null)}
                    disabled={box.status !== 'available'}
                    className={`
                      relative w-12 h-12 rounded-lg transition-all duration-200
                      flex items-center justify-center text-white font-bold text-xs
                      ${getBoxColor(box)}
                    `}
                    title={`Box ${box.number} - ${formatPrice(box.price_usd)} (${box.capacity} personas)`}
                  >
                    {box.status === 'available' ? box.code : (
                      <span className="text-gray-400 text-[10px] font-bold">{getBoxStatusText(box.status)}</span>
                    )}
                    {selectedBox === box.code && (
                      <Check className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full p-0.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Segunda Fila - B11 a B20 */}
            <div className="text-center mt-4 mb-1">
              <span className="text-xs text-gray-500">Segunda Fila</span>
            </div>
            <div className="flex justify-center gap-2">
              {secondRow.map(box => (
                <div key={box.code} className="relative">
                  <button
                    onClick={() => handleBoxClick(box)}
                    onMouseEnter={() => setHoveredBox(box.code)}
                    onMouseLeave={() => setHoveredBox(null)}
                    disabled={box.status !== 'available'}
                    className={`
                      relative w-12 h-12 rounded-lg transition-all duration-200
                      flex items-center justify-center text-white font-bold text-xs
                      ${getBoxColor(box)}
                    `}
                    title={`Box ${box.number} - ${formatPrice(box.price_usd)} (${box.capacity} personas)`}
                  >
                    {box.status === 'available' ? box.code : (
                      <span className="text-gray-400 text-[10px] font-bold">{getBoxStatusText(box.status)}</span>
                    )}
                    {selectedBox === box.code && (
                      <Check className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full p-0.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Tercera Fila - B21 a B30 */}
            <div className="text-center mt-4 mb-1">
              <span className="text-xs text-gray-500">Tercera Fila</span>
            </div>
            <div className="flex justify-center gap-2">
              {thirdRow.map(box => (
                <div key={box.code} className="relative">
                  <button
                    onClick={() => handleBoxClick(box)}
                    onMouseEnter={() => setHoveredBox(box.code)}
                    onMouseLeave={() => setHoveredBox(null)}
                    disabled={box.status !== 'available'}
                    className={`
                      relative w-12 h-12 rounded-lg transition-all duration-200
                      flex items-center justify-center text-white font-bold text-xs
                      ${getBoxColor(box)}
                    `}
                    title={`Box ${box.number} - ${formatPrice(box.price_usd)} (${box.capacity} personas)`}
                  >
                    {box.status === 'available' ? box.code : (
                      <span className="text-gray-400 text-[10px] font-bold">{getBoxStatusText(box.status)}</span>
                    )}
                    {selectedBox === box.code && (
                      <Check className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full p-0.5" />
                    )}
                  </button>
                  {box.floor_level > 1 && (
                    <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] text-gray-500">
                      P{box.floor_level}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zona Preferencial */}
        <div className="mb-6">
          <button
            onClick={() => onSelectZone('preferencial')}
            onMouseEnter={() => setHoveredZone('preferencial')}
            onMouseLeave={() => setHoveredZone(null)}
            className={`
              w-full relative overflow-hidden rounded-xl transition-all duration-300 transform
              ${selectedZone === 'preferencial' 
                ? 'ring-4 ring-green-400 ring-offset-2 ring-offset-gray-900 scale-[1.02]' 
                : hoveredZone === 'preferencial'
                ? 'scale-[1.01] shadow-2xl'
                : ''
              }
            `}
          >
            <div className={`
              relative h-64 bg-gradient-to-b transition-all duration-300
              ${selectedZone === 'preferencial'
                ? 'from-green-500/80 to-green-600/80'
                : hoveredZone === 'preferencial'
                ? 'from-[#ff8b6a]/80 to-[#ff6b4a]/80'
                : 'from-[#FD8D6A]/60 to-[#ff6b4a]/60'
              }
            `}>
              {/* Patrón de fondo */}
              <div className="absolute inset-0 opacity-10">
                <div className="grid grid-cols-12 gap-1 h-full p-4">
                  {[...Array(96)].map((_, i) => (
                    <div key={i} className="bg-white/20 rounded-sm"></div>
                  ))}
                </div>
              </div>
              
              {/* Contenido */}
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-white">
                <Users className="w-16 h-16 mb-4" />
                <h4 className="text-3xl font-bold mb-2">Zona Preferencial</h4>
                <p className="text-lg mb-1">Entrada General</p>
                <p className="text-2xl font-bold">{formatPrice(generalZone.price_usd)}</p>
                <div className="flex gap-4 mt-3">
                  <p className="text-sm bg-white/20 px-3 py-1 rounded-full">
                    Capacidad: {generalZone.capacity.toLocaleString()}
                  </p>
                  <p className="text-sm bg-green-500/30 px-3 py-1 rounded-full">
                    Disponibles: {generalZone.available.toLocaleString()}
                  </p>
                </div>
                {selectedZone === 'preferencial' && (
                  <div className="mt-4 bg-green-500 text-white px-6 py-2 rounded-full font-bold animate-pulse">
                    ✓ SELECCIONADO
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Información del Box seleccionado */}
        {hoveredBox && boxes.find(b => b.code === hoveredBox) && (
          <div className="fixed z-50 bg-gray-900 border border-gray-700 text-white p-4 rounded-lg shadow-2xl pointer-events-none max-w-xs"
               style={{ 
                 top: '50%', 
                 left: '50%', 
                 transform: 'translate(-50%, -50%)'
               }}>
            {(() => {
              const box = boxes.find(b => b.code === hoveredBox);
              if (!box) return null;
              
              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-bold text-[#FD8D6A] text-lg">Box {box.code}</h5>
                    {box.floor_level > 1}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm flex justify-between">
                      <span className="text-gray-400">Capacidad: </span>
                      <span className="font-semibold">{box.capacity} Personas</span>
                    </p>
                    <p className="text-sm flex justify-between">
                      <span className="text-gray-400">Precio total:</span>
                      <span className="font-semibold text-green-400">{formatPrice(box.price_usd)}</span>
                    </p>
                    {box.amenities && box.amenities.length > 0 && (
                      <div className="pt-2 border-t border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Incluye:</p>
                        <ul className="text-xs space-y-1">
                          {box.amenities.slice(0, 3).map((amenity, idx) => (
                            <li key={idx} className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500" />
                              <span>{amenity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {box.status === 'available' && (
                    <p className="text-xs text-center text-green-400 mt-3 font-semibold">
                      Click para seleccionar
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Leyenda */}
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h5 className="text-white font-bold mb-3 text-sm">info</h5>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-b from-[#FD8D6A] to-[#ff6b4a] rounded"></div>
              <span className="text-gray-300">Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-b from-green-500 to-green-600 rounded"></div>
              <span className="text-gray-300">Seleccionado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-700 rounded opacity-50"></div>
              <span className="text-gray-300">Vendido</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-b from-yellow-600 to-yellow-700 rounded opacity-75"></div>
              <span className="text-gray-300">Reservado</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-300">
                <p className="font-semibold mb-1">Información:</p>
                <ul className="space-y-1">
                  <li>• <strong>Zona Preferencial:</strong> Área general de pie ({generalZone.capacity.toLocaleString()} personas) - {formatPrice(generalZone.price_usd)}</li>
                  <li>• <strong>Boxes Premium:</strong> Áreas privadas para 10 personas - {formatPrice(75)} por box completo</li>
                  <li>• <strong>Amenidades Box:</strong> Vista privilegiada, servicio de bebidas, acceso VIP</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Box seleccionado - Información detallada */}
          {selectedBoxData && (
            <div className="mt-4 p-3 bg-green-900/30 rounded-lg border border-green-500/30">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-green-300">
                  <p className="font-semibold mb-1">Box Seleccionado: {selectedBoxData.code}</p>
                  <p>Precio total: {formatPrice(selectedBoxData.price_usd)} por {selectedBoxData.capacity} personas</p>
                  <p className="mt-1 text-green-400">Proceda con los datos del comprador para continuar</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueMap;