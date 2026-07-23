package com.vacation.judge.repository;

import com.vacation.judge.domain.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    List<Submission> findByUserId(Long userId);
    List<Submission> findByUserIdOrderByIdDesc(Long userId);
}
