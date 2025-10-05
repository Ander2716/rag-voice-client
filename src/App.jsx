import React, { useState, useRef, useEffect } from 'react';

// ====================================================================
// COMPONENTES DE ICONOS SVG LOCALES (Reemplazan lucide-react)
// ====================================================================

const IconWrapper = ({ children, size, className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        {children}
    </svg>
);

const MicIcon = (props) => (
    <IconWrapper {...props}>
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" x2="12" y1="19" y2="22"/>
    </IconWrapper>
);

const SendIcon = (props) => (
    <IconWrapper {...props}>
        <path d="m22 2-7 20-4-9-5-2.5 7-7Z"/>
        <path d="M22 2 11 13"/>
    </IconWrapper>
);

const RotateCcwIcon = (props) => (
    <IconWrapper {...props}>
        <path d="M3 6V3h3"/><path d="M3 6a10 10 0 0 1 17.8 8c-2.4 0-4.6 1-6.1 2.8"/>
    </IconWrapper>
); 

const XIcon = (props) => (
    <IconWrapper {...props}>
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </IconWrapper>
);

const Volume2Icon = (props) => (
    <IconWrapper {...props}>
        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
        <path d="M15.54 8.46a7 7 0 0 1 0 7.08"/>
    </IconWrapper>
);

const InfoIcon = (props) => (
    <IconWrapper {...props}>
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
    </IconWrapper>
);

const CloudOffIcon = (props) => (
    <IconWrapper {...props}>
        <path d="M22 17.5a2.5 2.5 0 0 0-2.5-2.5h-2.1a3 3 0 0 0-5.83-1.04"/>
        <path d="M16 9.4a5 5 0 0 0-4.5-2.4h-0.1"/>
        <path d="M10.3 5.4c-.4-.1-.8-.2-1.2-.2a5 5 0 0 0-4 2.1c-.8 1.4-1.2 3.1-1.2 5a6 6 0 0 0 1.9 4.3"/>
        <line x1="2" x2="22" y1="2" y2="22"/>
    </IconWrapper>
);

const SquareIcon = (props) => (
    <IconWrapper {...props}>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    </IconWrapper>
);

const ClipboardIcon = (props) => (
    <IconWrapper {...props}>
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    </IconWrapper>
);


// Inicialización de la API de Reconocimiento de Voz
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Definición de los estados del ciclo de vida de la aplicación
const STATES = {
    IDLE: 'IDLE',              // Esperando una nueva grabación
    RECORDING: 'RECORDING',    // Grabando audio
    TRANSCRIBING: 'TRANSCRIBING',// Procesando audio a texto (esperando onresult)
    READY_TO_SEND: 'READY_TO_SEND',// Transcripción lista, esperando confirmación/edición
    LOADING: 'LOADING',        // Enviando consulta a la API RAG
};

// ====================================================================
// CONFIGURACIÓN CLAVE
// ====================================================================

// ESTA URL DEBE APUNTAR A TU TUNEL DE CLOUDFLARE + /ask
const API_URL = "https://mineral-aging-scratch-rna.trycloudflare.com/ask"; 
// 🚨 ATENCIÓN: Por favor, reemplaza la URL anterior por tu URL ACTIVA
// Si tu API está en localhost:8000, necesitarás Cloudflare Tunnel o similar.

// ====================================================================
// COMPONENTE PRINCIPAL
// ====================================================================

const App = () => {
    const [appState, setAppState] = useState(STATES.IDLE);
    const [status, setStatus] = useState("Listo para grabar...");
    const [query, setQuery] = useState("");
    
    // ESTADO ACTUALIZADO: Almacena el objeto completo {answer, context, source, seccion, ...}
    const [ragResult, setRagResult] = useState(null); 
    
    const [sttSupported, setSttSupported] = useState(false);
    
    // Referencias para evitar problemas de sincronización con la API nativa
    const recognitionRef = useRef(null);
    const appStateRef = useRef(appState);
    const queryRef = useRef(query);
    const resultReceivedRef = useRef(false); 

    useEffect(() => {
        appStateRef.current = appState;
        queryRef.current = query;
        console.log(`[STATE CHANGE] New State: ${appState}, Query Length: ${query.length}`);
    }, [appState, query]);


    // Inicialización y configuración del STT
    useEffect(() => {
        if (SpeechRecognition) {
            setSttSupported(true);
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false; 
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'es-ES'; 
            
            // --- EVENTO DE RESULTADO ---
            recognitionRef.current.onresult = (event) => {
                const last = event.results.length - 1;
                const transcript = event.results[last][0].transcript;
                console.log(`[STT onresult] Transcripción: "${transcript}" (Length: ${transcript.length})`); 
                
                if (appStateRef.current === STATES.TRANSCRIBING) {
                    if (transcript.trim().length > 0) {
                        setQuery(transcript); 
                        resultReceivedRef.current = true;
                        setAppState(STATES.READY_TO_SEND);
                        setStatus("📝 Transcripción lista. Edita y presiona ENVIAR.");
                        console.log("[STT SUCCESS] Estado de botones habilitado.");
                    } else {
                        setStatus("No se detectó voz o la transcripción estaba vacía.");
                        setAppState(STATES.IDLE);
                    }
                }
            };

            // --- MANEJO DE ERRORES ---
            recognitionRef.current.onerror = (event) => {
                const currentState = appStateRef.current;
                console.error('[STT onerror] Error:', event.error);
                
                if (event.error !== 'no-speech' && currentState !== STATES.IDLE) {
                    setStatus(`❌ Error STT: ${event.error}. Intenta de nuevo.`);
                } else if (event.error === 'no-speech' && currentState === STATES.TRANSCRIBING) {
                    setStatus("No se detectó voz o la grabación fue muy corta.");
                }
                
                if (currentState === STATES.RECORDING || currentState === STATES.TRANSCRIBING) { 
                    setAppState(STATES.IDLE);
                }
            };

            // --- FIN DEL RECONOCIMIENTO (CORRECCIÓN CLAVE DE CARRERA) ---
            recognitionRef.current.onend = () => {
                console.log("[STT onend] Reconocimiento finalizado."); 
                
                if (appStateRef.current === STATES.TRANSCRIBING && !resultReceivedRef.current) {
                    setStatus("Tiempo de procesamiento finalizado. No se obtuvo transcripción.");
                    setAppState(STATES.IDLE);
                }
            };
        } else {
            setSttSupported(false);
            setStatus("❌ Error: Tu navegador no soporta el reconocimiento de voz.");
        }
    }, []); 

    // ====================================================================
    // FLUJO DE ESTADOS Y API RAG
    // ====================================================================

    const sendQueryToApi = async (textQuery) => {
        if (!textQuery || appState === STATES.LOADING) return;

        setAppState(STATES.LOADING);
        setRagResult(null); // Limpiar resultado anterior
        setStatus(`Enviando: "${textQuery}" a la API RAG...`);
        console.log("[API RAG] Iniciando envío de consulta."); 

        const payload = { query: textQuery };
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
    
                if (!res.ok) {
                    throw new Error(`Error HTTP: ${res.status} al comunicarse con la API.`);
                }
    
                const data = await res.json();
                
                // *** CAMBIO CLAVE: Procesar la nueva respuesta plana del API ***
                if (data.status === 'success' && data.answer) {
                    setRagResult(data); // Almacenar el objeto completo {answer, context, source, seccion}
                    setStatus("✅ Respuesta RAG recibida.");
                } else {
                    setRagResult({ 
                        answer: data.message || "La API devolvió un formato de respuesta inesperado o un error.",
                        context: 'N/A',
                        source: 'N/A',
                        seccion: 'N/A',
                        status: 'error'
                    });
                    setStatus("❌ Error de formato de respuesta o error de API.");
                }
                // ***************************************************************
                
                setAppState(STATES.IDLE); 
                return; 
            } catch (error) {
                lastError = error;
                console.error(`[API RAG] Intento ${attempt + 1} fallido.`, error);
                if (attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        console.error("[API RAG] Fallo final después de reintentos.", lastError);
        setStatus("❌ Hubo un error al comunicarse con la API. Revisa la URL y el túnel de Cloudflare.");
        setRagResult(null);
        setAppState(STATES.IDLE);
    };


    // --- 1. Grabar / Detener ---
    const handleRecordStopClick = () => {
        if (!sttSupported || appState === STATES.LOADING || appState === STATES.TRANSCRIBING) return;

        if (appState === STATES.IDLE || appState === STATES.READY_TO_SEND) {
            // Iniciar Grabación
            setQuery(""); 
            setRagResult(null); // Limpiar resultado anterior
            resultReceivedRef.current = false;
            
            try {
                recognitionRef.current.start();
                setAppState(STATES.RECORDING);
                setStatus("🔴 Grabando... Presiona para DETENER.");
                console.log("[STT] Grabación iniciada.");
            } catch (err) {
                if (err.name !== 'InvalidStateError') {
                    console.error("Error al iniciar el micrófono:", err);
                    setStatus("Error: No se pudo iniciar el micrófono. Verifica permisos.");
                    setAppState(STATES.IDLE);
                }
            }
        } else if (appState === STATES.RECORDING) {
            // Detener Grabación y Procesar
            if (recognitionRef.current) {
                recognitionRef.current.stop(); 
            }
            setAppState(STATES.TRANSCRIBING);
            setStatus("Procesando transcripción...");
            console.log("[STT] Grabación detenida. Esperando onresult/onend.");
        }
    };
    
    // --- 2. Enviar Consulta ---
    const handleSendClick = () => {
        if (appState === STATES.READY_TO_SEND) {
            sendQueryToApi(query);
        }
    };
    
    // --- 3. Cancelar / Reiniciar ---
    const handleCancelClick = () => {
        // Abortar si está grabando o transcribiendo
        if (appState === STATES.RECORDING || appState === STATES.TRANSCRIBING) {
            if (recognitionRef.current) {
                recognitionRef.current.abort(); 
            }
        } 
        
        // Resetear todo el estado
        resultReceivedRef.current = false;
        setAppState(STATES.IDLE);
        setQuery(""); 
        setRagResult(null); // Limpiar resultado
        setStatus("Operación cancelada. Listo para grabar...");
        console.log("[RESET] Estado de la aplicación reseteado.");
    }

    // ====================================================================
    // ESTILOS DINÁMICOS Y CONTENIDO
    // ====================================================================

    // Estilos para el botón principal (Grabar/Detener)
    const getMainButtonStyles = () => {
        let base = "relative w-28 h-28 flex items-center justify-center rounded-full transition-all duration-300 shadow-xl text-white";
        
        if (appState === STATES.RECORDING) {
            return `${base} bg-red-600 hover:bg-red-700 ring-4 ring-red-300 transform scale-105`;
        }
        // IDLE, READY_TO_SEND, etc.
        return `${base} bg-blue-600 hover:bg-blue-700 ring-4 ring-blue-300`;
    };

    const getMainButtonContent = () => {
        if (appState === STATES.RECORDING) {
            return <SquareIcon size={32} />; // Icono de detener
        }
        return <MicIcon size={32} />; // Icono de micrófono
    };
    
    // Estilos para el botón de Enviar
    const getSendButtonClasses = () => {
        const disabled = appState !== STATES.READY_TO_SEND || query.length === 0 || appState === STATES.LOADING;
        
        return `px-6 py-2 rounded-full font-semibold transition-colors duration-200 flex items-center justify-center space-x-2 w-full md:w-auto
            ${disabled 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-green-600 text-white hover:bg-green-700 shadow-md'}`;
    }
    
    // Estilos para el botón de Cancelar
    const getCancelButtonClasses = () => {
        const disabled = appState === STATES.IDLE || appState === STATES.LOADING;
        
        return `px-6 py-2 rounded-full font-semibold transition-colors duration-200 flex items-center justify-center space-x-2 w-full md:w-auto
            ${disabled 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-red-600 text-white hover:bg-red-700 shadow-md'}`;
    }

    const isMainButtonDisabled = appState === STATES.LOADING || appState === STATES.TRANSCRIBING || !sttSupported;
    const isTextareaDisabled = appState !== STATES.READY_TO_SEND;

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
                        {(appState === STATES.LOADING || appState === STATES.TRANSCRIBING) ? (
                            <RotateCcwIcon size={16} className="text-orange-500 animate-spin" />
                        ) : sttSupported ? (
                             <InfoIcon size={16} className="text-blue-600" />
                        ) : (
                             <CloudOffIcon size={16} className="text-red-600" />
                        )}
                        
                        <span className={`text-gray-700 ${appState === STATES.LOADING || appState === STATES.TRANSCRIBING ? 'text-orange-500 font-semibold' : ''}`}>
                            {status}
                        </span>
                    </div>
                    {/* Campo de Consulta */}
                    <div className="w-full">
                        <label className="text-xs font-semibold text-gray-500 block mb-1">
                            Consulta ({isTextareaDisabled ? "Solo Lectura" : "Editable"}):
                        </label>
                        <textarea
                            className={`w-full text-sm text-gray-800 p-3 rounded-md border resize-none ${isTextareaDisabled ? 'bg-gray-100 text-gray-500' : 'bg-white focus:ring-green-500 focus:border-green-500'}`}
                            rows={3}
                            placeholder={appState === STATES.READY_TO_SEND ? "Edita la transcripción aquí antes de enviar..." : "Graba tu consulta para empezar..."}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={isTextareaDisabled}
                        />
                    </div>
                </div>

                {/* Área de Botones de Acción */}
                <div className="flex flex-col items-center space-y-4 w-full">
                    
                    {/* Botón Central: GRABAR / DETENER */}
                    <div className="relative flex justify-center items-center">
                        {appState === STATES.RECORDING && (
                            <div className="absolute w-32 h-32 bg-red-400 rounded-full opacity-50 pulse-effect"></div>
                        )}
                        <button
                            onClick={handleRecordStopClick}
                            disabled={isMainButtonDisabled}
                            className={getMainButtonStyles()}
                            title={appState === STATES.RECORDING ? "Detener Grabación" : "Iniciar Grabación"}
                        >
                            {getMainButtonContent()}
                        </button>
                    </div>
                    
                    <p className="text-sm text-gray-500 font-medium h-4">
                        {appState === STATES.RECORDING ? "Presiona para DETENER" : "Presiona para GRABAR"}
                    </p>

                    {/* Botones Secundarios: ENVIAR y CANCELAR */}
                    <div className="flex space-x-4 w-full justify-center mt-4">
                        
                        {/* Botón de Enviar Consulta */}
                        <button
                            onClick={handleSendClick}
                            disabled={appState !== STATES.READY_TO_SEND || query.length === 0 || appState === STATES.LOADING}
                            className={getSendButtonClasses()}
                        >
                            <SendIcon size={20} />
                            <span>Enviar</span>
                        </button>

                        {/* Botón de Cancelar */}
                        <button 
                            onClick={handleCancelClick}
                            disabled={appState === STATES.IDLE || appState === STATES.LOADING}
                            className={getCancelButtonClasses()}
                        >
                            <XIcon size={20} />
                            <span>Cancelar</span>
                        </button>
                    </div>

                </div>

                {/* Área de Respuesta RAG (Muestra si ragResult tiene datos) */}
                {ragResult && (
                    <div className="w-full border-t border-gray-200 pt-6 mt-6 space-y-6">

                        {/* Metadatos de Fuente */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                            <p className="font-semibold text-gray-700 flex items-center space-x-2">
                                <ClipboardIcon size={16} className="text-blue-500"/>
                                <span>Fuente:</span>
                                <span className="text-blue-700 font-bold break-all">{ragResult.source || 'Desconocida'}</span>
                            </p>
                            <p className="font-semibold text-gray-700 flex items-center space-x-2">
                                <InfoIcon size={16} className="text-blue-500"/>
                                <span>Sección (ID):</span>
                                <span className="text-blue-700 font-bold break-all">{ragResult.seccion || 'N/A'}</span>
                            </p>
                        </div>
                        
                        {/* Respuesta Generada */}
                        <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3 flex items-center space-x-2">
                                <Volume2Icon size={20} className="text-green-600"/>
                                <span>Respuesta Generada</span>
                            </h2>
                            {/* Usamos dangerouslySetInnerHTML para renderizar el HTML limpio del backend (e.g., <strong>) */}
                            <div 
                                className="text-gray-700 leading-relaxed space-y-3"
                                dangerouslySetInnerHTML={{ __html: ragResult.answer || 'Respuesta no disponible.' }}
                            ></div>
                        </div>

                        {/* Contexto Recuperado */}
                        <div className="bg-gray-100 p-5 rounded-xl shadow-inner border border-gray-300">
                            <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Contexto de la Fuente</h2>
                            <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                                {ragResult.context || 'Contexto no disponible.'}
                            </pre>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
