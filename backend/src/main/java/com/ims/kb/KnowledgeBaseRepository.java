package com.ims.kb;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBaseArticle, Long> {

    Optional<KnowledgeBaseArticle> findByKbNumber(String kbNumber);

    List<KnowledgeBaseArticle> findByTitleContainingIgnoreCaseOrKeywordsContainingIgnoreCase(String title, String keywords);
}
