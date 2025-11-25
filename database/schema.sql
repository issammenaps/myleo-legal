-- Myleo Chatbot Database Schema
-- MySQL 8.4.6 Compatible

-- Drop tables if they exist (for development)
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS faqs;

-- FAQs table to store FAQ data with internationalization
CREATE TABLE faqs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    language_code VARCHAR(5) NOT NULL DEFAULT 'fr',
    is_active BOOLEAN DEFAULT TRUE,
    meta_keywords TEXT,
    meta_description TEXT,
    product_name VARCHAR(255),
    product_ref VARCHAR(100),
    rubrique ENUM('produit', 'compte_client', 'tunnel_vente', 'general') NOT NULL DEFAULT 'general',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    qa_data JSON NOT NULL,
    external_id VARCHAR(100) UNIQUE, -- For tracking changes from external source
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_language_active (language_code, is_active),
    INDEX idx_rubrique (rubrique),
    INDEX idx_product_ref (product_ref),
    INDEX idx_external_id (external_id),
    INDEX idx_last_updated (last_updated),
    FULLTEXT KEY ft_title_keywords (title, meta_keywords, meta_description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversations table to store chat sessions
CREATE TABLE conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL UNIQUE, -- UUID
    language_code VARCHAR(5) NOT NULL DEFAULT 'fr',
    rubrique ENUM('produit', 'compte_client', 'tunnel_vente', 'general') DEFAULT 'general',
    product_code VARCHAR(100),
    user_ip VARCHAR(45), -- Support IPv6
    user_agent TEXT,
    status ENUM('active', 'resolved', 'escalated', 'abandoned') DEFAULT 'active',
    satisfaction_rating TINYINT UNSIGNED, -- 1-5 rating
    zendesk_ticket_id VARCHAR(100), -- If escalated to Zendesk
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    
    INDEX idx_session_id (session_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_rubrique_product (rubrique, product_code),
    INDEX idx_zendesk_ticket (zendesk_ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat messages table to store individual messages
CREATE TABLE chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    message_type ENUM('user', 'bot', 'system') NOT NULL,
    message_text TEXT NOT NULL,
    faq_id INT NULL, -- Reference to FAQ if bot response is from FAQ
    response_time_ms INT UNSIGNED, -- Time taken to generate response
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (faq_id) REFERENCES faqs(id) ON DELETE SET NULL,
    
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_message_type (message_type),
    INDEX idx_created_at (created_at),
    INDEX idx_faq_id (faq_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a view for FAQ search with all relevant data
CREATE VIEW faq_search_view AS
SELECT 
    f.id,
    f.title,
    f.language_code,
    f.rubrique,
    f.product_ref,
    f.meta_keywords,
    f.meta_description,
    f.qa_data,
    f.last_updated
FROM faqs f
WHERE f.is_active = TRUE;

-- Create indexes for better performance
CREATE INDEX idx_faq_search ON faqs(language_code, rubrique, is_active);
CREATE INDEX idx_conversation_messages ON chat_messages(conversation_id, created_at);

-- Additional indexes for semantic search optimization
CREATE INDEX idx_faq_product_active ON faqs(product_ref, language_code, is_active);
CREATE INDEX idx_faq_rubrique_lang ON faqs(rubrique, language_code, is_active, last_updated);
CREATE INDEX idx_conversation_status_date ON conversations(status, created_at);
CREATE INDEX idx_conversation_rubrique_product ON conversations(rubrique, product_code, language_code);

-- Composite index for frequent queries
CREATE INDEX idx_faq_search_composite ON faqs(is_active, language_code, rubrique, product_ref, last_updated);

-- Index for analytics queries
CREATE INDEX idx_conversation_analytics ON conversations(created_at, status, rubrique, language_code);
CREATE INDEX idx_message_response_time ON chat_messages(response_time_ms, created_at) WHERE response_time_ms IS NOT NULL;

-- Add some sample data for testing (optional)
SET @json = '[
    {
        "code": "app.faq_entry",
        "data": {
            "question": "Comment puis-je contacter le support ?",
            "answer": "Vous pouvez nous contacter via ce chat, par email à support@myleo.com ou par téléphone au 01 23 45 67 89."
        }
    },
    {
        "code": "app.faq_entry",
        "data": {
            "question": "Quels sont vos horaires d\'ouverture ?",
            "answer": "Nous sommes ouverts du lundi au vendredi de 9h à 18h et le samedi de 10h à 16h."
        }
    }
]';

INSERT INTO faqs (title, language_code, rubrique, qa_data, external_id)
VALUES ('Questions générales sur les produits', 'fr', 'produit', @json, 'sample_faq_1');
INSERT INTO faqs (title, language_code, rubrique, qa_data, external_id)
VALUES
-- 1
(
    'Qui êtes-vous Me Lèguevaques ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Qui êtes-vous Me Lèguevaques ?',
            'answer', 'D’aucuns diront qu’il est hyperactif. Né en 68, Christophe Lèguevaques aime casser les codes. Très tôt, il croit aux class actions à la française. Originaire de Toulouse, inscrit au barreau de Paris, il devient l’un des promoteurs des actions collectives (AZF, Levothyrox, Linky, Chlordécone, Dieselgate…).'
        )
    ),
    'faq_myleo_1'
),

-- 2
(
    'En quoi consiste MyLeo ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'En quoi consiste MyLeo ?',
            'answer', 'MyLeo est une plateforme digitale sécurisée facilitant la mise en relation entre justiciables et avocats. Elle vise à rendre la justice plus accessible, identifier les actions collectives éthiques, sélectionner des avocats experts et accompagner les justiciables.'
        )
    ),
    'faq_myleo_2'
),

-- 3
(
    'Comment puis-je participer ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Comment puis-je participer ?',
            'answer', 'Vous pouvez signer une pétition, souscrire une gazette, acheter des goodies ou devenir demandeur en justice via une convention d’honoraires.'
        )
    ),
    'faq_myleo_3'
),

-- 4
(
    'Combien cela coûtera-t-il ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Combien cela coûtera-t-il ?',
            'answer', 'Cela dépend de l’action : certaines sont gratuites, d’autres demandent une participation symbolique ou une contribution financière si une indemnisation est envisageable.'
        )
    ),
    'faq_myleo_4'
),

-- 5
(
    'Des frais supplémentaires sont-ils à prévoir ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Des frais supplémentaires sont-ils à prévoir ?',
            'answer', 'Tous les frais éventuels sont clairement détaillés pour chaque action.'
        )
    ),
    'faq_myleo_5'
),

-- 6
(
    'Quel est le lien juridique qui nous unira ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Quel est le lien juridique qui nous unira ?',
            'answer', 'MyLeo n’est pas un avocat. Le lien juridique existe entre vous et l’avocat via une convention d’honoraires que vous acceptez avant toute action.'
        )
    ),
    'faq_myleo_6'
),

-- 7
(
    'Puis-je transmettre des données sensibles ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Puis-je transmettre des données sensibles ?',
            'answer', 'Oui. La plateforme est construite pour protéger vos données. Le DPO veille au respect du RGPD et l’équipe technique renforce la sécurité quotidiennement.'
        )
    ),
    'faq_myleo_7'
),

-- 8
(
    'Je n’ai pas d’adresse mail. Que faire ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Je n’ai pas d’adresse mail. Que faire ?',
            'answer', 'Contactez le service client au 05 67 700 484 ou à contact@myleo.legal.'
        )
    ),
    'faq_myleo_8'
),

-- 9
(
    'Je n’arrive pas à m’inscrire. Que dois-je faire ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Je n’arrive pas à m’inscrire. Que dois-je faire ?',
            'answer', 'Veuillez contacter le service client au 05 67 700 484 ou par email à contact@myleo.legal.'
        )
    ),
    'faq_myleo_9'
),

-- 10
(
    'Je n’ai pas reçu le mail de confirmation. Est-ce normal ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Je n’ai pas reçu le mail de confirmation. Est-ce normal ?',
            'answer', 'Vérifiez vos spams. Si le mail n’y est pas, contactez contact@myleo.legal.'
        )
    ),
    'faq_myleo_10'
),

-- 11
(
    'Quand serons-nous fixés ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Quand serons-nous fixés ?',
            'answer', 'L’avocat informe régulièrement des délais raisonnables et envoie des courriers ou newsletters.'
        )
    ),
    'faq_myleo_11'
),

-- 12
(
    'Mon paiement ne passe pas. Que dois-je faire ?',
    'fr',
    'general',
    JSON_OBJECT(
        'code', 'app.faq_entry',
        'data', JSON_OBJECT(
            'question', 'Mon paiement ne passe pas. Que dois-je faire ?',
            'answer', 'Contactez le service client au 05 67 700 484 ou envoyez un mail à contact@myleo.legal.'
        )
    ),
    'faq_myleo_12'
);

