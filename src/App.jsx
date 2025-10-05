import React, { useState, useRef, useEffect } from 'react';

// 🚨 IMPORTANTE: REEMPLAZA ESTA URL CON TU CLOUDFLARE TUNNEL ACTIVA
const API_URL = "https://codes-bruce-attempts-your.trycloudflare.com/ask"; 

const App = () => {
    // --- ESTADOS DE LA APLICACIÓN ---
    const [status, setStatus] = useState('Listo. Mantén presionado el micrófono para iniciar la consulta.');
    const [query, setQuery] = useState('Aquí aparecerá el texto transcrito (simulado).');
    const [response, setResponse] = useState('La respuesta del modelo RAG aparecerá aquí.');
    const [sources, setSources] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // --- REFERENCIAS DE AUDIO ---
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);
    const buttonRef = useRef(null);


    // ====================================================================
    // LÓGICA DE CONEXIÓN CON LA API RAG
    // ====================================================================

    const sendQueryToApi = async (queryToSend) => {
        setStatus("🚀 Conectando con Cloudflare Tunnel...");
        setResponse("Esperando respuesta...");
        setSources([]);
        setIsLoading(true);

        const payload = { query: queryToSend };

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: Código ${res.status}`);
            }

            const data = await res.json();
            
            setStatus("✅ Respuesta RAG recibida.");
            setResponse(data.answer || "No se recibió una respuesta válida del campo 'answer'.");
            
            if (data.source_documents && Array.isArray(data.source_documents)) {
                setSources(data.source_documents);
            } else {
                setSources([]);
            }

        } catch (error) {
            setStatus(`❌ Error API: ${error.message}`);
            setResponse(`Hubo un error al comunicarse con la API. Asegúrate de que el túnel de Cloudflare esté activo y la URL sea correcta.`);
            setSources([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ====================================================================
    // SIMULACIÓN DE TRANSCRIPCIÓN Y ENVÍO
    // ====================================================================

    const simulateTranscription = (audioBlob) => {
        // En un entorno real, enviarías el 'audioBlob' a un servicio STT.
        // Aquí, simulamos el resultado para probar el flujo de la API RAG.
        setStatus("⏳ Simulación: Transcribiendo y enviando a la API...");
        const simulatedQuery = "Encuentra la definición de 'Contextualización Padre-Hijo'.";
        setQuery(`Simulación: ${simulatedQuery}`);
        
        // Simular un tiempo de procesamiento
        setTimeout(() => {
            sendQueryToApi(simulatedQuery);
        }, 500); 
    };

    // ====================================================================
    // MANEJO DEL MICRÓFONO Y EVENTOS
    // ====================================================================

    const startRecording = async () => {
        if (isRecording || isLoading) return;
        
        try {
            // Solicitar acceso al micrófono
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream; // Guardar la referencia al stream para detenerlo
            
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            
            mediaRecorder.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                // Detener la pista de audio del micrófono después de grabar
                streamRef.current.getTracks().forEach(track => track.stop()); 
                
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                simulateTranscription(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
            
            // Actualizar UI
            setStatus('🔴 Grabando... Habla ahora.');
            setQuery('... (Grabando audio) ...');
            
        } catch (err) {
            setStatus(`❌ Error de Micrófono: ${err.message}`);
            setIsRecording(false);
            // Si hay un error, el botón se rehabilita por el `finally` de sendQueryToApi,
            // pero si falla al inicio, lo deshabilitamos aquí.
            buttonRef.current.disabled = true;
        }
    };

    const stopRecording = () => {
        if (!isRecording || mediaRecorderRef.current.state === 'inactive') return;
        
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        
        // La lógica de envío se dispara dentro del mediaRecorder.onstop
    };
    
    // --- EFECTO PARA VINCULAR EVENTOS (Mouse y Touch) ---
    useEffect(() => {
        const button = buttonRef.current;
        if (!button) return;

        // Limpiar para evitar duplicados
        button.removeEventListener('mousedown', startRecording);
        button.removeEventListener('mouseup', stopRecording);
        button.removeEventListener('touchstart', startRecording);
        button.removeEventListener('touchend', stopRecording);
        
        // Vincular eventos de Ratón (Desktop)
        button.addEventListener('mousedown', startRecording);
        button.addEventListener('mouseup', stopRecording);
        
        // Vincular eventos Táctiles (Móvil)
        const handleTouchStart = (e) => { e.preventDefault(); startRecording(); };
        const handleTouchEnd = (e) => { e.preventDefault(); stopRecording(); };

        button.addEventListener('touchstart', handleTouchStart);
        button.addEventListener('touchend', handleTouchEnd);

        return () => {
            // Limpieza al desmontar el componente
            button.removeEventListener('mousedown', startRecording);
            button.removeEventListener('mouseup', stopRecording);
            button.removeEventListener('touchstart', handleTouchStart);
            button.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isRecording, isLoading]); // Re-ejecutar si el estado cambia

    // --- RENDERIZADO DE LA INTERFAZ ---
    const buttonText = isRecording ? 'SOLTAR PARA ENVIAR' : isLoading ? 'PROCESANDO...' : 'Mantener para Hablar';
    
    // Clases CSS dinámicas para el botón
    const buttonClasses = `
        mic-button rounded-full text-white flex items-center justify-center text-xs font-bold uppercase transition duration-150
        ${isRecording ? 'bg-red-500 recording-pulse' : 'bg-blue-600'}
        ${(isLoading || isRecording) ? 'cursor-default' : 'hover:bg-blue-700 cursor-pointer'}
    `;

    return (
        <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4" style={{ fontFamily: 'Inter, sans-serif' }}>
            <div className="w-full max-w-lg bg-white p-6 rounded-xl shadow-2xl space-y-6">
                
                <h1 className="text-3xl font-extrabold text-center text-gray-800">Asistente RAG por Voz (React)</h1>
                <p className="text-center text-sm text-gray-500">Mantén presionado el micrófono para iniciar la consulta.</p>

                {/* 1. Estado Actual (Status) */}
                <div id="statusMessage" className={`text-center text-lg font-semibold h-6 ${isRecording ? 'text-red-600' : 'text-blue-600'}`}>
                    {status}
                </div>

                {/* 2. Contenedor de la Respuesta */}
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="font-bold text-blue-800 mb-1">Tu Consulta:</p>
                        <p id="queryText" className="text-gray-700 italic">{query}</p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg shadow-inner min-h-[100px]">
                        <p className="font-bold text-gray-800 mb-1">Respuesta RAG:</p>
                        <p id="responseText" className="text-gray-600">{isLoading ? 'Cargando...' : response}</p>
                    </div>
                    
                    {/* 3. Fuentes de Documentos */}
                    <div id="sourcesContainer" className={`${sources.length > 0 ? 'block' : 'hidden'} bg-gray-50 p-3 rounded-lg border border-gray-200`}>
                        <p className="font-bold text-gray-800 mb-1">Fuentes:</p>
                        <ul id="sourcesList" className="list-disc list-inside text-sm text-gray-600 space-y-0.5">
                            {sources.map((source, index) => (
                                <li key={index}>{source}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* 4. Botón de Grabación */}
                <div className="flex justify-center pt-4">
                    <button 
                        ref={buttonRef}
                        id="listenButton" 
                        className={buttonClasses}
                        disabled={isLoading && !isRecording} // No se puede usar si está cargando y no está ya grabando
                        style={{width: '150px', height: '150px'}}
                    >
                        {buttonText}
                    </button>
                </div>

            </div>
            
            {/* Estilos CSS (Replicados aquí para que funcionen con React) */}
            <style jsx global>{`
                .mic-button {
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
                    transition: all 0.2s ease-in-out;
                }
                .mic-button:active {
                    transform: scale(0.95);
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                }
                .recording-pulse {
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>
        </div>
    );
};

export default App;
