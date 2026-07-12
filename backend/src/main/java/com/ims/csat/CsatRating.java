package com.ims.csat;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A customer satisfaction rating for a resolved/closed request, tied to the assigned analyst. */
@Entity
@Table(name = "csat_ratings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CsatRating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private Long incidentId;

    /** Snapshot of the assigned analyst at rating time (for per-analyst reporting). */
    private Long analystId;

    private String analystName;

    private int rating;

    @Column(length = 1000)
    private String comment;

    private String submittedBy;

    private LocalDateTime createdAt;
}
