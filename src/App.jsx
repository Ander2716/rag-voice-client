import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, RotateCcw, X, Volume2, Info, CloudOff, Slash, Square } from 'lucide-react';

// Inicialización de la API de Reconocimiento de Voz
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Definición de los estados del ciclo de vida de la aplicación
const STATES = {
    IDLE: 'IDLE',              // Esperando una nueva grabación
    RECORDING: 'RECORDING',    // Grabando audio
    TRANSCRIBING: 'TRANSCRIBING',// Procesando audio a texto (esperando onresult)
    READY_TO_SEND: 'READY_TO_SEND',// Transcripción lista, esperando confirmación/edición
    LOADING: 'LOADING',        // Enviando consulta a la API RAG
};

// ====================================================================
// CONFIGURACIÓN CLAVE
// ====================================================================

// ESTA URL DEBE APUNTAR A TU TUNEL DE CLOUDFLARE + /ask
const API_URL = "https://mineral-aging-scratch-rna.trycloudflare.com/ask"; 
// 🚨 ATENCIÓN: Por favor, reemplaza la URL anterior por tu URL ACTIVA

// ====================================================================
// COMPONENTE PRINCIPAL
// ====================================================================

const App = () => {
    const [appState, setAppState] = useState(STATES.IDLE);
    const [status, setStatus] = useState("Listo para grabar...");
    const [query, setQuery] = useState("");
    const [response, setResponse] = useState(null);
    const [sttSupported, setSttSupported] = useState(false);
    
    // Referencias para MediaRecorder y SpeechRecognition
    const mediaRecorderRef = useRef(null);
    const recognitionRef = useRef(null);

    // Inicialización y configuración del STT
    useEffect(() => {
        if (SpeechRecognition) {
            setSttSupported(true);
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false; 
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'es-ES'; 
            
            // Cuando la transcripción está lista: ¡NO ENVIAR, SÓLO MOSTRAR!
            recognitionRef.current.onresult = (event) => {
                const last = event.results.length - 1;
                const transcript = event.results[last][0].transcript;
                
                // Si la transcripción es válida y estamos esperando (TRANSCRIBING), pasamos a READY_TO_SEND
                if (transcript && appState === STATES.TRANSCRIBING) {
                    setQuery(transcript); 
                    setAppState(STATES.READY_TO_SEND);
                    setStatus("📝 Revisa, edita y presiona ENVIAR.");
                } else if (appState === STATES.TRANSCRIBING) {
                    // Transcripción vacía, volver a IDLE
                    setStatus("No se detectó voz. Listo para grabar...");
                    setAppState(STATES.IDLE);
                }
            };

            // Manejo de errores de transcripción
            recognitionRef.current.onerror = (event) => {
                if (event.error !== 'no-speech' && appState !== STATES.IDLE) {
                    console.error('Speech Recognition Error:', event.error);
                    setStatus(`❌ Error STT: ${event.error}. Intenta de nuevo.`);
                } else if (event.error === 'no-speech' && appState === STATES.TRANSCRIBING) {
                    setStatus("No se detectó voz o la grabación fue muy corta.");
                }
                // Si hay error (y no fue un abort), volvemos a IDLE
                if (appState !== STATES.IDLE) { 
                    setAppState(STATES.IDLE);
                }
            };

            // Cuando el reconocimiento de voz termina (si no hubo resultado)
            recognitionRef.current.onend = () => {
                if (appState === STATES.TRANSCRIBING) {
                    // Si el estado sigue en TRANSCRIBING significa que onresult no se disparó
                    setStatus("Procesamiento finalizado sin transcripción.");
                    setAppState(STATES.IDLE);
                }
            };
        } else {
            setSttSupported(false);
            setStatus("❌ Error: Tu navegador no soporta el reconocimiento de voz.");
        }
    }, [appState]); // Dependencia en appState para garantizar el onresult/onend se evalúa correctamente

    // ====================================================================
    // FLUJO DE ESTADOS
    // ====================================================================

    // Función para enviar la consulta (EDITABLE) a la API RAG
    const sendQueryToApi = async (textQuery) => {
        if (!textQuery) {
            setStatus("La consulta está vacía. Graba o escribe algo.");
            return;
        }

        setAppState(STATES.LOADING);
        setResponse(null);
        setStatus(`Enviando: "${textQuery}" a la API RAG...`);

        const payload = { query: textQuery };

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                setStatus(`Error HTTP: ${res.status} al comunicarse con la API.`);
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            
            if (data.answer) {
                setResponse(data.answer);
                setStatus("Respuesta RAG recibida.");
            } else {
                setResponse("La API devolvió un formato de respuesta inesperado.");
                setStatus("Error de formato de respuesta.");
            }
        } catch (error) {
            console.error("Error de conexión con la API:", error);
            setStatus("Hubo un error al comunicarse con la API. Asegúrate de que el túnel de Cloudflare esté activo y la URL sea correcta.");
            setResponse(null);
        } finally {
            // Regresar al estado IDLE después de la respuesta
            setAppState(STATES.IDLE);
        }
    };

    // Helper: Iniciar Grabación
    const startRecording = async () => {
        if (!sttSupported) return; 
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Inicia MediaRecorder para mantener el micrófono activo
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.start();
            
            // Inicia el reconocimiento de voz
            recognitionRef.current.start();
            
            setAppState(STATES.RECORDING);
            setStatus("🔴 Grabando... Presiona DETENER.");

            // Detener el MediaRecorder y liberar el stream
            mediaRecorderRef.current.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
            };

        } catch (err) {
            console.error("Error al acceder al micrófono:", err);
            setStatus("Error: No se pudo acceder al micrófono. Verifica permisos.");
            setAppState(STATES.IDLE);
        }
    };

    // Helper: Detener Grabación y Procesar Transcripción
    const stopRecording = () => {
        if (appState === STATES.RECORDING) {
            // Detiene la grabación de audio
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            // Detiene el reconocimiento de voz (dispara onresult/onerror/onend)
            if (recognitionRef.current) {
                recognitionRef.current.stop(); 
            }
            setAppState(STATES.TRANSCRIBING);
            setStatus("Procesando transcripción...");
        }
    };
    
    // Función de Cancelación
    const cancelOperation = () => {
        // 1. Si está grabando o transcribiendo: Abortar procesos
        if (appState === STATES.RECORDING || appState === STATES.TRANSCRIBING) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (recognitionRef.current) {
                recognitionRef.current.abort(); // Abort detiene sin disparar onresult/onend
            }
            setStatus("Grabación/Procesamiento cancelado.");
        } 
        
        // 2. Resetear todo el estado para volver a IDLE
        setAppState(STATES.IDLE);
        setQuery(""); 
        setResponse(null);
        setStatus("Listo para grabar...");
    }

    // Lógica del botón principal de acción (Micrófono/Detener/Enviar)
    const handleMainButtonClick = () => {
        if (appState === STATES.IDLE) {
            startRecording();
        } else if (appState === STATES.RECORDING) {
            stopRecording();
        } else if (appState === STATES.READY_TO_SEND) {
            sendQueryToApi(query); // Envía la consulta actual (editada o no)
        }
        // No hace nada en estados TRANSCRIBING o LOADING
    };
    
    // ====================================================================
    // ESTILOS DINÁMICOS
    // ====================================================================

    const getButtonStyles = () => {
        let base = "relative w-28 h-28 flex items-center justify-center rounded-full transition-all duration-300 shadow-xl text-white";
        
        if (appState === STATES.LOADING || appState === STATES.TRANSCRIBING) {
            return `${base} bg-gray-400 cursor-not-allowed`;
        }
        if (appState === STATES.RECORDING) {
            return `${base} bg-gray-600 hover:bg-gray-700 ring-4 ring-gray-300 transform scale-105`;
        }
        if (appState === STATES.READY_TO_SEND) {
            return `${base} bg-green-600 hover:bg-green-700 ring-4 ring-green-300 transform scale-105`;
        }
        // IDLE
        return `${base} bg-blue-600 hover:bg-blue-700 ring-4 ring-blue-300`;
    };

    const getButtonContent = () => {
        if (appState === STATES.LOADING) {
            return <RotateCcw size={32} className="animate-spin" />;
        }
        if (appState === STATES.TRANSCRIBING) {
            return <RotateCcw size={32} className="animate-spin" />;
        }
        if (appState === STATES.RECORDING) {
            return <Square size={32} />; // Icono de detener
        }
        if (appState === STATES.READY_TO_SEND) {
            return <Send size={32} />; // Icono de enviar
        }
        // IDLE
        return <Mic size={32} />; // Icono de micrófono
    };

    const getButtonLabel = () => {
        if (appState === STATES.RECORDING) return "Detener";
        if (appState === STATES.READY_TO_SEND) return "Enviar Consulta";
        return "Grabar Consulta";
    };

    const isButtonDisabled = appState === STATES.LOADING || appState === STATES.TRANSCRIBING || !sttSupported;


    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                }
                .pulse-effect {
                    animation: pulse-ring 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                @keyframes pulse-ring {
                    0% { transform: scale(0.33); }
                    80%, 100% { opacity: 0; }
                }
            `}</style>
            <div className="w-full max-w-lg bg-white shadow-2xl rounded-xl p-6 md:p-8 space-y-6 flex flex-col items-center">
                
                {/* Header */}
                <div className="text-center w-full">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                        Asistente RAG de Voz
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Backend local (Python/Ollama) vía Cloudflare Tunnel.
                    </p>
                </div>

                {/* Área de estado y consulta */}
                <div className="w-full bg-blue-50/50 border border-blue-100 rounded-lg p-4 space-y-3">
                    <div className="flex items-center space-x-2 text-sm font-medium">
                        {sttSupported ? (
                             <Info size={16} className="text-blue-600" />
                        ) : (
                             <CloudOff size={16} className="text-red-600" />
                        )}
                       
                        <span className={`text-gray-700 ${appState === STATES.LOADING || appState === STATES.TRANSCRIBING ? 'text-orange-500 font-semibold' : ''}`}>
                            {status}
                        </span>
                    </div>
                    {/* Campo de Consulta (Editable solo en READY_TO_SEND) */}
                    <div className="w-full">
                        <label className="text-xs font-semibold text-gray-500 block mb-1">
                            Tu Consulta:
                        </label>
                        <textarea
                            className="w-full text-sm text-gray-800 bg-white p-3 rounded-md border focus:ring-blue-500 focus:border-blue-500 resize-none"
                            rows={3}
                            placeholder={appState === STATES.READY_TO_SEND ? "Edita la transcripción aquí..." : "Graba tu consulta para empezar..."}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={appState !== STATES.READY_TO_SEND}
                        />
                    </div>
                </div>

                {/* Botón de Acción Central */}
                <div className="relative flex justify-center items-center py-6">
                    {(appState === STATES.RECORDING || appState === STATES.TRANSCRIBING) && (
                        <div className="absolute w-32 h-32 bg-red-400 rounded-full opacity-50 pulse-effect"></div>
                    )}
                    <button
                        onClick={handleMainButtonClick}
                        disabled={isButtonDisabled}
                        className={getButtonStyles()}
                    >
                        {getButtonContent()}
                    </button>
                </div>
                
                {/* Controles bajo el micrófono (Etiqueta y Cancelar) */}
                <div className="flex justify-center w-full space-x-4 h-6 items-center">
                    <p className="text-sm text-gray-500 font-medium">
                        {getButtonLabel()}
                    </p>
                    
                    {(appState === STATES.RECORDING || appState === STATES.TRANSCRIBING || appState === STATES.READY_TO_SEND) && (
                        <button 
                            onClick={cancelOperation} 
                            className="text-sm font-medium text-red-600 hover:text-red-800 transition duration-150 flex items-center space-x-1"
                        >
                            <Slash size={16} />
                            <span>Cancelar</span>
                        </button>
                    )}
                </div>

                {/* Área de Respuesta RAG */}
                {response && (
                    <div className="w-full bg-white border-t-4 border-blue-500 rounded-lg p-5 shadow-lg space-y-3 mt-6">
                        <h2 className="text-lg font-bold text-blue-700 flex items-center space-x-2">
                            <Volume2 size={20} />
                            <span>Respuesta del RAG (Ollama)</span>
                        </h2>
                        <p className="text-gray-700 whitespace-pre-wrap">{response}</p>
                    </div>
                )}
                
                {/* Botón de Reset completo */}
                <button 
                    onClick={cancelOperation} // Usamos cancelOperation para reiniciar todo
                    className="mt-4 text-sm text-gray-500 hover:text-red-500 transition duration-150 flex items-center space-x-1"
                >
                    <X size={16} />
                    <span>Reiniciar Aplicación</span>
                </button>
            </div>
        </div>
    );
};

export default App;
