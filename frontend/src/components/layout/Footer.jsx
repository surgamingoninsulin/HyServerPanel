import './Footer.css';

function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-content">
                <p>
                    Created by <a href="https://github.com/surgamingoninsulin" target="_blank" rel="noopener noreferrer">GamingOnInsulin</a>
                </p>
                <p className="footer-date">&copy; {currentYear} Hytale Server Panel  is Licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">GPL-3.0 License</a></p>
            </div>
        </footer>
    );
}

export default Footer;
