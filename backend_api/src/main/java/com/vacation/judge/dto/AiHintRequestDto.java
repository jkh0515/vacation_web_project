package com.vacation.judge.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AiHintRequestDto {
    private String problemText;
    private String failedCode;
}
