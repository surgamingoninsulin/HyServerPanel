import { useState, useEffect } from 'react';
import { useServer } from '../../contexts/ServerContext';
import * as settingsApi from '../../services/settingsApi';

function JsonFileEditor({ filename }) {
    const { currentServer } = useServer();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        if (currentServer?.id) {
            loadFile();
        }
    }, [filename, currentServer?.id]);

    const loadFile = async () => {
        if (!currentServer?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await settingsApi.getFileSettings(filename, currentServer.id);
            // Convert object/array to formatted string
            setContent(JSON.stringify(data, null, 4));
        } catch (err) {
            setError(err.message + ". Check if Server Path is correct.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setContent(e.target.value);
        setSuccess(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentServer?.id) {
            setError("No server selected. Please select a server first.");
            return;
        }

        setError(null);
        setSuccess(null);

        try {
            // Validate JSON
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (jsonErr) {
                throw new Error("Invalid JSON Syntax: " + jsonErr.message);
            }

            await settingsApi.saveFileSettings(filename, parsed, currentServer.id);
            setSuccess(`${filename} saved successfully for "${currentServer.name}"!`);
            // format it nicely again
            setContent(JSON.stringify(parsed, null, 4));
        } catch (err) {
            setError(err.message);
        }
    };

    if (!currentServer) {
        return (
            <div className="card">
                <div className="status-badge status-offline" style={{ display: 'block' }}>
                    No server selected. Please select a server from the dropdown above.
                </div>
            </div>
        );
    }

    if (loading) return <div>Loading {filename}...</div>;

    return (
        <div className="card">
            <h2 className="card-title">
                Editing: {filename}
                {currentServer && (
                    <span style={{ 
                        fontSize: '0.8rem', 
                        color: 'var(--text-muted)', 
                        fontWeight: 'normal',
                        marginLeft: '10px'
                    }}>
                        for {currentServer.name}
                    </span>
                )}
            </h2>

            {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
            {success && <div className="status-badge status-online" style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <textarea
                        value={content}
                        onChange={handleChange}
                        className="input-field"
                        style={{
                            minHeight: '400px',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre',
                            tabSize: 4
                        }}
                    />
                    <small>Make sure to maintain valid JSON syntax.</small>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button type="submit" className="btn btn-primary">Save Changes</button>
                    <button type="button" onClick={loadFile} className="btn btn-secondary">Reload File</button>
                </div>
            </form>
        </div>
    );
}

export default JsonFileEditor;
