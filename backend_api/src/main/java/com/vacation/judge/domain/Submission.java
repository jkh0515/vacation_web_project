package com.vacation.judge.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AccessLevel;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Submission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "problem_id")
    private Problem problem;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String code;

    private String language;

    @Setter
    private String status; // PENDING, PROCESSING, SUCCESS, FAIL, TIMEOUT, ERROR

    @Setter
    @Column(columnDefinition = "TEXT")
    private String resultOutput;

    public Submission(User user, Problem problem, String code, String language) {
        this.user = user;
        this.problem = problem;
        this.code = code;
        this.language = language;
        this.status = "PENDING";
    }
}
